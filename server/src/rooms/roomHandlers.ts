// 房间事件编排：GameEngine 分派 + 多局本轮制。
import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { Room, Player, GameMode, RoundGameResult } from '../types/room.js';
import { createRoomStore } from './roomStore.js';
import { createLobbyService } from './lobbyService.js';
import { createMatchService } from './matchService.js';
import { canTransition, nextWaitingState } from './roomStateMachine.js';
import { toPublicRoom, isFull, allReady, toRoomStatePayload, makeRoomName } from './roomHelpers.js';
import { getEngine, gameState, type VersusGame } from '../games/index.js';
import type { GameSeed, PlayerProgress, GameAction, FinalizedProgress } from '../games/types.js';
import { recordMatch, type MatchPlayerInput } from '../stats/statsRepository.js';
import type { PlayerResult, GameEndPayload } from '../types/schulte.js';

const COUNTDOWN_SECONDS = 3;
const MATCH_TIMEOUT_MS = 30000;
const PROGRESS_INTERVAL_MS = 500;

// 校验建房/重配的游戏选择
function validateGames(roundMode: 'single' | 'multi', games: unknown): GameMode[] | null {
  if (!Array.isArray(games) || games.length === 0) return null;
  const validModes: GameMode[] = ['schulte', 'stroop', 'sequence', 'bottle'];
  for (const g of games) {
    if (!validModes.includes(g as GameMode)) return null;
  }
  // 不可重复
  if (new Set(games).size !== games.length) return null;
  if (roundMode === 'single' && games.length !== 1) return null;
  if (roundMode === 'multi' && (games.length < 2 || games.length > 4)) return null;
  return games as GameMode[];
}

// 从 detail 提取 found/errors（各游戏语义不同），用于战绩累计
function extractFoundErrors(detail: Record<string, unknown>, mode: GameMode): { found: number; errors: number } {
  if (mode === 'schulte') {
    return { found: (detail.found as number) ?? 0, errors: (detail.errors as number) ?? 0 };
  }
  if (mode === 'stroop') {
    return { found: (detail.correct as number) ?? 0, errors: (detail.errors as number) ?? 0 };
  }
  if (mode === 'sequence') {
    const correct = (detail.positionCorrect as number) ?? 0;
    const total = 6;  // SEQUENCE_LENGTH
    return { found: correct, errors: total - correct };
  }
  if (mode === 'bottle') {
    const matched = (detail.matched as number) ?? 0;
    const total = (detail.total as number) ?? 6;
    return { found: matched, errors: total - matched };
  }
  return { found: 0, errors: 0 };
}

export function attachRoomHandlers(io: SocketIOServer): void {
  const store = createRoomStore();
  // 房间级定时器
  const roomTimers = new Map<string, {
    progress: ReturnType<typeof setInterval>;
    timeLimit: ReturnType<typeof setTimeout>;
    grace?: ReturnType<typeof setTimeout>;
  }>();
  const lobby = createLobbyService((socketId, event, payload) => {
    io.to(socketId).emit(event, payload);
  });
  const match = createMatchService(
    {
      onMatched: (a, b) => {
        const host: Player = { ...a, isHost: true };
        const guest: Player = { ...b, isHost: false, ready: true };
        // 快速匹配：固定单局舒尔特
        const room = store.create(a.id, host, { name: makeRoomName(a.name), roundMode: 'single', games: ['schulte'] });
        room.players.push(guest);
        room.state = nextWaitingState(room);
        joinSocketToRoom(io, a.socketId, room.roomId);
        joinSocketToRoom(io, b.socketId, room.roomId);
        broadcastRoomState(io, room);
        io.to(a.socketId).emit('match:found', { roomId: room.roomId, opponent: { id: b.id, name: b.name, avatar: b.avatar } });
        io.to(b.socketId).emit('match:found', { roomId: room.roomId, opponent: { id: a.id, name: a.name, avatar: a.avatar } });
      },
      onTimeout: (userId) => {
        const sock = findSocketByUserId(io, userId);
        sock?.emit('match:timeout');
      },
    },
    { timeoutMs: MATCH_TIMEOUT_MS },
  );

  io.on('connection', (socket: Socket) => {
    const userId = socket.userId!;

    const player = (): Player => ({
      id: userId,
      socketId: socket.id,
      name: socket.userName ?? '未知',
      avatar: socket.userAvatar ?? '❓',
      ready: true,
      isHost: false,
      connected: true,
    });

    // ===== 大厅 =====
    socket.on('lobby:subscribe', () => {
      socket.join('lobby');
      lobby.subscribe(socket.id, store.findPublic());
    });
    socket.on('lobby:unsubscribe', () => {
      socket.leave('lobby');
      lobby.unsubscribe(socket.id);
    });

    // ===== 快速匹配（固定舒尔特）=====
    socket.on('match:queue', () => {
      if (store.findByPlayerId(userId)) removePlayer(io, socket, store, lobby, userId);
      match.enqueue(userId, player());
    });
    socket.on('match:cancel', () => { match.cancel(userId); });

    // ===== 创建房间 =====
    socket.on('room:create', (input: { name?: string; roundMode?: 'single' | 'multi'; games?: GameMode[] } | undefined) => {
      if (store.findByPlayerId(userId)) removePlayer(io, socket, store, lobby, userId);
      const roundMode = input?.roundMode ?? 'single';
      const games = validateGames(roundMode, input?.games ?? ['schulte']);
      if (!games) {
        socket.emit('room:error', { message: '游戏选择不合法' });
        return;
      }
      const host: Player = { ...player(), isHost: true };
      const name = input?.name?.trim() || makeRoomName(host.name);
      const room = store.create(userId, host, { name, roundMode, games });
      joinSocketToRoom(io, socket.id, room.roomId);
      broadcastRoomState(io, room);
      const pub = toPublicRoom(room);
      if (pub) lobby.broadcastRoomAdded(pub);
    });

    // ===== 加入房间 =====
    socket.on('room:join', (input: { roomId: string }) => {
      if (store.findByPlayerId(userId)) removePlayer(io, socket, store, lobby, userId);
      const room = store.get(input.roomId);
      if (!room) { socket.emit('room:error', { message: '房间不存在' }); return; }
      if (isFull(room)) { socket.emit('room:error', { message: '房间已满' }); return; }
      const guest: Player = { ...player(), isHost: false, ready: true };
      room.players.push(guest);
      const newState = nextWaitingState(room);
      if (canTransition(room.state, newState)) room.state = newState;
      joinSocketToRoom(io, socket.id, room.roomId);
      broadcastRoomState(io, room);
      const pub = toPublicRoom(room);
      if (pub) lobby.broadcastRoomChanged(pub);
    });

    // ===== 离开 =====
    socket.on('room:leave', () => {
      removePlayer(io, socket, store, lobby, userId);
    });

    // ===== 房主重配游戏（仅本轮结束后）=====
    socket.on('room:reconfigure', (input: { roundMode: 'single' | 'multi'; games: GameMode[] }) => {
      const room = store.findByPlayerId(userId);
      if (!room) return;
      const me = room.players.find((p) => p.id === userId);
      if (!me?.isHost) { socket.emit('room:error', { message: '只有房主能更换游戏' }); return; }
      if (!room.hostCanChangeGames) { socket.emit('room:error', { message: '本轮未结束，不能更换游戏' }); return; }
      const games = validateGames(input.roundMode, input.games);
      if (!games) { socket.emit('room:error', { message: '游戏选择不合法' }); return; }
      room.roundMode = input.roundMode;
      room.gameQueue = games;
      room.currentQueueIndex = 0;
      room.roundResults = [];
      room.gameMode = games[0];
      room.hostCanChangeGames = false;
      // 重置双方准备
      room.players.forEach((p) => { p.ready = false; });
      broadcastRoomState(io, room);
    });

    // ===== 准备切换 =====
    socket.on('player:ready', (input: { ready: boolean }) => {
      const room = store.findByPlayerId(userId);
      if (!room) return;
      const p = room.players.find((x) => x.id === userId);
      if (!p) return;
      p.ready = input.ready;
      broadcastRoomState(io, room);
      const pub = toPublicRoom(room);
      if (pub) lobby.broadcastRoomChanged(pub);
    });

    // ===== 游戏动作（原 game:tap，现按 mode 分派）=====
    socket.on('game:action', (input: { mode: GameMode; payload: unknown }) => {
      const room = store.findByPlayerId(userId);
      if (!room) return;
      const game = gameState.get(room.roomId);
      if (!game || game.ended) return;
      const engine = getEngine(room.gameMode);
      const prog = game.players.get(userId);
      if (!prog) return;

      const action = { mode: room.gameMode, ...(input.payload as object) } as GameAction;
      const result = engine.applyAction(prog, action, game.seed, game.startTime, Date.now());
      gameState.updateProgress(room.roomId, userId, result.progress);

      checkGameEnd(room);
    });

    // ===== 房主开始 =====
    socket.on('room:start', () => {
      const room = store.findByPlayerId(userId);
      if (!room) return;
      const me = room.players.find((p) => p.id === userId);
      if (!me?.isHost) { socket.emit('room:error', { message: '只有房主能开始' }); return; }
      if (!isFull(room) || !allReady(room)) { socket.emit('room:error', { message: '需要全员准备' }); return; }
      if (!canTransition(room.state, 'countdown')) return;
      room.state = 'countdown';
      broadcastRoomState(io, room);
      lobby.broadcastRoomRemoved(room.roomId);

      let remaining = COUNTDOWN_SECONDS;
      io.to(room.roomId).emit('room:countdown', { remaining });
      const timer = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
          io.to(room.roomId).emit('room:countdown', { remaining });
        } else {
          clearInterval(timer);
          startGame(room);
        }
      }, 1000);
    });

    // ===== 断线 =====
    socket.on('disconnect', () => {
      lobby.unsubscribe(socket.id);
      match.cancel(userId);
      const room = store.findByPlayerId(userId);
      if (room) {
        const game = gameState.get(room.roomId);
        if (game && !game.ended) {
          endGame(room, 'disconnect', userId);
        }
      }
      removePlayer(io, socket, store, lobby, userId);
    });
  });

  // 开始一局：用引擎生成 seed，广播 game:start，启动定时器
  function startGame(room: Room): void {
    if (!canTransition(room.state, 'playing')) return;
    room.state = 'playing';
    broadcastRoomState(io, room);

    const engine = getEngine(room.gameMode);
    const seed = engine.generateSeed();
    const startTime = Date.now();
    const playerIds = room.players.map((p) => p.id);
    const players = new Map<string, PlayerProgress>();
    for (const pid of playerIds) {
      players.set(pid, engine.createProgress());
    }
    const game: VersusGame = {
      roomId: room.roomId,
      mode: room.gameMode,
      seed,
      startTime,
      timeLimitMs: engine.timeLimitMs,
      players,
      ended: false,
      graceTimerStarted: false,
    };
    gameState.create(game);

    io.to(room.roomId).emit('game:start', {
      mode: room.gameMode,
      seed,
      startTime,
      timeLimitMs: engine.timeLimitMs,
      queueIndex: room.currentQueueIndex,
      totalInRound: room.gameQueue.length,
    });

    // 进度广播
    const progressTimer = setInterval(() => {
      broadcastProgress(room.roomId);
    }, PROGRESS_INTERVAL_MS);

    // 时间上限兜底
    const timeLimitTimer = setTimeout(() => {
      const g = gameState.get(room.roomId);
      if (g && !g.ended) endGame(room, 'timeout');
    }, engine.timeLimitMs);

    roomTimers.set(room.roomId, { progress: progressTimer, timeLimit: timeLimitTimer });
  }

  // 广播进度（归一化 percent）
  function broadcastProgress(roomId: string): void {
    const game = gameState.get(roomId);
    if (!game || game.ended) return;
    const engine = getEngine(game.mode);
    const playerIds = [...game.players.keys()];
    if (playerIds.length !== 2) return;
    const [aId, bId] = playerIds;
    const pa = game.players.get(aId)!;
    const pb = game.players.get(bId)!;
    const aPercent = engine.computePercent(pa, game.seed);
    const bPercent = engine.computePercent(pb, game.seed);
    const aDone = isDone(pa);
    const bDone = isDone(pb);

    const sockA = findSocketByUserId(io, aId);
    sockA?.emit('game:progress', { mode: game.mode, me: { percent: aPercent, done: aDone }, opponent: { percent: bPercent, done: bDone } });
    const sockB = findSocketByUserId(io, bId);
    sockB?.emit('game:progress', { mode: game.mode, me: { percent: bPercent, done: bDone }, opponent: { percent: aPercent, done: aDone } });
  }

  // 判断某玩家是否「已完成」（各游戏语义不同）
  function isDone(p: PlayerProgress): boolean {
    if (p.mode === 'schulte') return p.done;
    if (p.mode === 'stroop') return p.done;
    if (p.mode === 'sequence') return p.submitted;
    if (p.mode === 'bottle') return p.done;
    return false;
  }

  // 检查游戏是否结束（按 mode 分派结算时机）
  function checkGameEnd(room: Room): void {
    const game = gameState.get(room.roomId);
    if (!game || game.ended) return;
    const engine = getEngine(game.mode);
    const progresses = [...game.players.values()];
    const anyDone = progresses.some((p) => isDone(p));
    const allDone = progresses.every((p) => isDone(p));

    if (engine.shouldEndWhenAnyDone) {
      // race：舒尔特/暗瓶——任一方完成即结束
      if (anyDone) { endGame(room, 'completed'); return; }
    } else if (game.mode === 'stroop') {
      // 字色：任一方完成 → 给对方启动宽限倒计时（只一次）
      if (anyDone && !game.graceTimerStarted) {
        game.graceTimerStarted = true;
        const graceSec = game.seed.mode === 'stroop' ? game.seed.finishGraceSec : 10;
        io.to(room.roomId).emit('game:grace', { seconds: graceSec });
        const graceTimer = setTimeout(() => {
          const g = gameState.get(room.roomId);
          if (g && !g.ended) endGame(room, 'grace_timeout');
        }, graceSec * 1000);
        const t = roomTimers.get(room.roomId);
        if (t) t.grace = graceTimer;
      }
      if (allDone) { endGame(room, 'completed'); return; }
    } else if (game.mode === 'sequence') {
      // 序列：双方都提交才结算（超时由 timeLimit 兜底）
      if (allDone) { endGame(room, 'completed'); return; }
    }
  }

  // 结束游戏：裁定 + 广播 + 战绩 + 多局推进
  function endGame(room: Room, reason: 'completed' | 'timeout' | 'disconnect' | 'grace_timeout', loserId?: string): void {
    const game = gameState.get(room.roomId);
    if (!game || game.ended) return;
    game.ended = true;
    gameState.markEnded(room.roomId);

    // 清理定时器
    const timers = roomTimers.get(room.roomId);
    if (timers) {
      clearInterval(timers.progress);
      clearTimeout(timers.timeLimit);
      if (timers.grace) clearTimeout(timers.grace);
      roomTimers.delete(room.roomId);
    }

    const playerIds = [...game.players.keys()];
    if (playerIds.length !== 2) { gameState.remove(room.roomId); return; }
    const [aId, bId] = playerIds;
    const engine = getEngine(game.mode);

    let aFinal: FinalizedProgress;
    let bFinal: FinalizedProgress;
    if (reason === 'disconnect' && loserId) {
      const loserIsA = loserId === aId;
      aFinal = engine.finalize(game.players.get(aId)!, game.seed, game.startTime, Date.now());
      bFinal = engine.finalize(game.players.get(bId)!, game.seed, game.startTime, Date.now());
      if (loserIsA) aFinal = { ...aFinal, accuracy: 0 };
      else bFinal = { ...bFinal, accuracy: 0 };
    } else {
      const endTime = Date.now();
      aFinal = engine.finalize(game.players.get(aId)!, game.seed, game.startTime, endTime);
      bFinal = engine.finalize(game.players.get(bId)!, game.seed, game.startTime, endTime);
    }

    const winnerFromA = determineWinner(aFinal, bFinal);
    const aWon = winnerFromA === 'me';
    const bWon = winnerFromA === 'opponent';

    // 各游戏从 detail 提取 found/errors，避免硬编码 0 把累计战绩归零
    const aFE = extractFoundErrors(aFinal.detail, game.mode);
    const bFE = extractFoundErrors(bFinal.detail, game.mode);

    const aResult: PlayerResult = { playerId: aId, found: aFE.found, errors: aFE.errors, accuracy: aFinal.accuracy, timeMs: aFinal.timeMs, done: aFinal.done, won: aWon };
    const bResult: PlayerResult = { playerId: bId, found: bFE.found, errors: bFE.errors, accuracy: bFinal.accuracy, timeMs: bFinal.timeMs, done: bFinal.done, won: bWon };

    emitGameEndTo(aId, aResult, bResult, aFinal.detail);
    emitGameEndTo(bId, bResult, aResult, bFinal.detail);

    // 写战绩
    const playerA = room.players.find((p) => p.id === aId);
    const playerB = room.players.find((p) => p.id === bId);
    const playersForStats: MatchPlayerInput[] = [
      { playerId: aId, name: playerA?.name ?? '未知', avatar: playerA?.avatar ?? '❓', found: aFE.found, errors: aFE.errors, accuracy: aFinal.accuracy, timeMs: aFinal.timeMs, done: aFinal.done, won: aWon },
      { playerId: bId, name: playerB?.name ?? '未知', avatar: playerB?.avatar ?? '❓', found: bFE.found, errors: bFE.errors, accuracy: bFinal.accuracy, timeMs: bFinal.timeMs, done: bFinal.done, won: bWon },
    ];
    const winnerId = aWon ? aId : bWon ? bId : null;
    recordMatch({ roomId: room.roomId, gameMode: room.gameMode, winnerId, players: playersForStats }).catch((err) => console.error('[stats] 战绩写入失败:', err));

    // 记入本轮结果
    const roundResult: RoundGameResult = {
      gameMode: room.gameMode,
      queueIndex: room.currentQueueIndex,
      results: [
        { playerId: aId, won: aWon, accuracy: aFinal.accuracy, timeMs: aFinal.timeMs },
        { playerId: bId, won: bWon, accuracy: bFinal.accuracy, timeMs: bFinal.timeMs },
      ],
    };
    room.roundResults.push(roundResult);

    gameState.remove(room.roomId);

    // 多局推进
    const nextIndex = room.currentQueueIndex + 1;
    if (nextIndex < room.gameQueue.length) {
      // 还有下一局
      room.currentQueueIndex = nextIndex;
      room.gameMode = room.gameQueue[nextIndex];
      room.state = 'finished';
      const newState = nextWaitingState(room);
      if (canTransition('finished', newState)) room.state = newState;
      room.players.forEach((p) => { p.ready = false; });
      broadcastRoomState(io, room);
      io.to(room.roomId).emit('room:nextRound', {
        nextMode: room.gameMode,
        queueIndex: room.currentQueueIndex,
        totalInRound: room.gameQueue.length,
        roundResults: room.roundResults,
      });
    } else {
      // 本轮结束
      room.hostCanChangeGames = true;
      room.state = 'finished';
      const newState = nextWaitingState(room);
      if (canTransition('finished', newState)) room.state = newState;
      room.players.forEach((p) => { p.ready = false; });
      broadcastRoomState(io, room);
      io.to(room.roomId).emit('room:roundEnd', { roundResults: room.roundResults });
    }
  }

  function determineWinner(a: { accuracy: number; timeMs: number }, b: { accuracy: number; timeMs: number }): 'me' | 'opponent' | 'draw' {
    if (Math.abs(a.accuracy - b.accuracy) > 1e-9) return a.accuracy > b.accuracy ? 'me' : 'opponent';
    if (a.timeMs !== b.timeMs) return a.timeMs < b.timeMs ? 'me' : 'opponent';
    return 'draw';
  }

  function emitGameEndTo(viewerId: string, myResult: PlayerResult, opponentResult: PlayerResult, detail: Record<string, unknown>): void {
    const winner: 'me' | 'opponent' | 'draw' = myResult.won ? 'me' : (opponentResult.won ? 'opponent' : 'draw');
    const payload: GameEndPayload = { winner, myResult, opponentResult, detail };
    const sock = findSocketByUserId(io, viewerId);
    sock?.emit('game:end', payload);
  }
}

// ===== 辅助函数 =====
function joinSocketToRoom(io: SocketIOServer, socketId: string, roomId: string): void {
  const sock = io.sockets.sockets.get(socketId);
  sock?.join(roomId);
}
function broadcastRoomState(io: SocketIOServer, room: Room): void {
  io.to(room.roomId).emit('room:state', toRoomStatePayload(room));
}
function findSocketByUserId(io: SocketIOServer, userId: string): Socket | undefined {
  for (const sock of io.sockets.sockets.values()) {
    if (sock.userId === userId) return sock;
  }
  return undefined;
}

// 玩家离开/断线：从房间移除，处理房主转让、本轮清空、空房销毁
function removePlayer(
  io: SocketIOServer,
  socket: Socket,
  store: ReturnType<typeof createRoomStore>,
  lobby: ReturnType<typeof createLobbyService>,
  userId: string,
): void {
  const room = store.findByPlayerId(userId);
  if (!room) return;
  const wasPublic = toPublicRoom(room) !== null;
  room.players = room.players.filter((p) => p.id !== userId);
  socket.leave(room.roomId);

  if (room.players.length === 0) {
    store.remove(room.roomId);
    if (wasPublic) lobby.broadcastRoomRemoved(room.roomId);
    return;
  }

  // 房主走了，转让
  if (room.hostId === userId) {
    const newHost = room.players[0];
    newHost.isHost = true;
    room.hostId = newHost.id;
    room.name = makeRoomName(newHost.name);
  }

  // 非房主退出 → 本轮状态全部重置（战绩已在 DB，不影响）
  room.currentQueueIndex = 0;
  room.roundResults = [];
  room.gameMode = room.gameQueue[0];
  room.hostCanChangeGames = false;
  room.players.forEach((p) => { p.ready = false; });

  const newState = nextWaitingState(room);
  if (canTransition(room.state, newState)) room.state = newState;
  broadcastRoomState(io, room);
  const pub = toPublicRoom(room);
  if (pub && wasPublic) lobby.broadcastRoomChanged(pub);
}
