// 房间事件编排：注册所有 B 阶段 Socket.IO 事件处理器。
import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { Room, Player } from '../types/room.js';
import { createRoomStore } from './roomStore.js';
import { createLobbyService } from './lobbyService.js';
import { createMatchService } from './matchService.js';
import { canTransition, nextWaitingState } from './roomStateMachine.js';
import { toPublicRoom, isFull, allReady, toRoomStatePayload, makeRoomName } from './roomHelpers.js';
import { generateGrid, applyTap, finalizeProgress, determineWinner } from '../schulte/schulteGame.js';
import { createGameStore } from '../schulte/gameStore.js';
import type { PlayerResult, GameEndPayload, RoomGame } from '../types/schulte.js';

const COUNTDOWN_SECONDS = 3;
const MATCH_TIMEOUT_MS = 30000;
const GRID_SIZE = 5;
const TIME_LIMIT_MS = 90000;
const PROGRESS_INTERVAL_MS = 500;

export function attachRoomHandlers(io: SocketIOServer): void {
  const store = createRoomStore();
  const games = createGameStore();
  // 房间级定时器：roomId → { progress, timeLimit }，结束时清理
  const roomTimers = new Map<string, {
    progress: ReturnType<typeof setInterval>;
    timeLimit: ReturnType<typeof setTimeout>;
  }>();
  const lobby = createLobbyService((socketId, event, payload) => {
    io.to(socketId).emit(event, payload);
  });
  const match = createMatchService(
    {
      onMatched: (a, b) => {
        // 配对成功：建房，两人加入，进 ready。a 为房主。
        const host: Player = { ...a, isHost: true };
        const guest: Player = { ...b, isHost: false, ready: true };
        const room = store.create(a.id, host, { name: makeRoomName(a.name) });
        room.players.push(guest);
        room.state = nextWaitingState(room); // 2人 → ready
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

    // 构造当前连接的 Player 快照
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

    // ===== 快速匹配 =====
    socket.on('match:queue', () => {
      if (store.findByPlayerId(userId)) return; // 已在房间
      match.enqueue(userId, player());
    });

    socket.on('match:cancel', () => {
      match.cancel(userId);
    });

    // ===== 创建房间 =====
    socket.on('room:create', (input: { name?: string } | undefined) => {
      if (store.findByPlayerId(userId)) return;
      const host: Player = { ...player(), isHost: true };
      const name = input?.name?.trim() || makeRoomName(host.name);
      const room = store.create(userId, host, { name });
      joinSocketToRoom(io, socket.id, room.roomId);
      broadcastRoomState(io, room);
      const pub = toPublicRoom(room);
      if (pub) lobby.broadcastRoomAdded(pub);
    });

    // ===== 加入房间 =====
    socket.on('room:join', (input: { roomId: string }) => {
      if (store.findByPlayerId(userId)) return;
      const room = store.get(input.roomId);
      if (!room) {
        socket.emit('room:error', { message: '房间不存在' });
        return;
      }
      if (isFull(room)) {
        socket.emit('room:error', { message: '房间已满' });
        return;
      }
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

    // ===== 游戏中点击 =====
    socket.on('game:tap', (input: { cellIndex: number }) => {
      const room = store.findByPlayerId(userId);
      if (!room) return;
      const game = games.get(room.roomId);
      if (!game || game.ended) return;
      const prog = game.players.get(userId);
      if (!prog || prog.done) return;

      const result = applyTap(game.grid, prog, input.cellIndex, game.target);
      games.updateProgress(game.roomId, userId, {
        found: result.progress.found,
        errors: result.progress.errors,
        done: result.progress.done,
        finishTime: result.progress.finishTime,
      });

      // 双方都 done → 结束
      checkGameEnd(game.roomId);
    });

    // ===== 房主开始 =====
    socket.on('room:start', () => {
      const room = store.findByPlayerId(userId);
      if (!room) return;
      const me = room.players.find((p) => p.id === userId);
      if (!me?.isHost) {
        socket.emit('room:error', { message: '只有房主能开始' });
        return;
      }
      if (!isFull(room) || !allReady(room)) {
        socket.emit('room:error', { message: '需要全员准备' });
        return;
      }
      if (!canTransition(room.state, 'countdown')) return;
      room.state = 'countdown';
      broadcastRoomState(io, room);
      // 进 countdown 后房间不再对大厅可见
      lobby.broadcastRoomRemoved(room.roomId);

      // 倒计时
      let remaining = COUNTDOWN_SECONDS;
      io.to(room.roomId).emit('room:countdown', { remaining });
      const timer: ReturnType<typeof setInterval> = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
          io.to(room.roomId).emit('room:countdown', { remaining });
        } else {
          clearInterval(timer);
          // countdown 结束 → 开始游戏（计划三）
          startGame(room);
        }
      }, 1000);
    });

    // ===== 断线 =====
    socket.on('disconnect', () => {
      lobby.unsubscribe(socket.id);
      match.cancel(userId);
      // 游戏中断线：判该方弃赛负
      const room = store.findByPlayerId(userId);
      if (room) {
        const game = games.get(room.roomId);
        if (game && !game.ended) {
          endGame(room, 'disconnect', userId);
        }
      }
      removePlayer(io, socket, store, lobby, userId);
    });
  });

  // 开始一局游戏：生成表、广播 game:start、启动进度广播 + 时间上限定时器
  function startGame(room: Room): void {
    if (!canTransition(room.state, 'playing')) return;
    room.state = 'playing';
    broadcastRoomState(io, room);

    const grid = generateGrid(GRID_SIZE);
    const playerIds = room.players.map((p) => p.id);
    const startTime = Date.now();
    const game = games.create({
      roomId: room.roomId,
      grid,
      startTime,
      timeLimitMs: TIME_LIMIT_MS,
      target: grid.length,
      playerIds,
    });

    io.to(room.roomId).emit('game:start', {
      grid,
      startTime,
      size: GRID_SIZE,
      target: grid.length,
      timeLimitMs: TIME_LIMIT_MS,
    });

    // 进度广播定时器：每 500ms 下发双方进度（每人收 me+opponent 视角）
    const progressTimer = setInterval(() => {
      broadcastProgress(game.roomId);
    }, PROGRESS_INTERVAL_MS);

    // 时间上限定时器：到点强制结算
    const timeLimitTimer = setTimeout(() => {
      const g = games.get(game.roomId);
      if (g && !g.ended) {
        endGame(room, 'timeout');
      }
    }, TIME_LIMIT_MS);

    roomTimers.set(room.roomId, { progress: progressTimer, timeLimit: timeLimitTimer });
  }

  // 广播进度给房间双方（每人收到 me + opponent 视角）
  function broadcastProgress(roomId: string): void {
    const game = games.get(roomId);
    if (!game || game.ended) return;
    const playerIds = [...game.players.keys()];
    if (playerIds.length !== 2) return;
    const [aId, bId] = playerIds;
    const pa = game.players.get(aId)!;
    const pb = game.players.get(bId)!;

    const sockA = findSocketByUserId(io, aId);
    sockA?.emit('game:progress', {
      me: { found: pa.found, errors: pa.errors, done: pa.done },
      opponent: { found: pb.found, errors: pb.errors, done: pb.done },
    });
    const sockB = findSocketByUserId(io, bId);
    sockB?.emit('game:progress', {
      me: { found: pb.found, errors: pb.errors, done: pb.done },
      opponent: { found: pa.found, errors: pa.errors, done: pa.done },
    });
  }

  // 检查游戏是否结束（双方都 done）
  function checkGameEnd(roomId: string): void {
    const game = games.get(roomId);
    if (!game || game.ended) return;
    const allDone = [...game.players.values()].every((p) => p.done);
    if (allDone) {
      const room = store.findByPlayerId([...game.players.keys()][0]);
      if (room) endGame(room, 'completed');
    }
  }

  // 结束游戏：裁定胜负、广播 game:end、清理定时器、房间回 waiting/ready
  function endGame(
    room: Room,
    reason: 'completed' | 'timeout' | 'disconnect',
    loserId?: string,
  ): void {
    const game = games.get(room.roomId);
    if (!game || game.ended) return;
    game.ended = true;
    games.markEnded(room.roomId);

    // 清理定时器
    const timers = roomTimers.get(room.roomId);
    if (timers) {
      clearInterval(timers.progress);
      clearTimeout(timers.timeLimit);
      roomTimers.delete(room.roomId);
    }

    const playerIds = [...game.players.keys()];
    if (playerIds.length !== 2) {
      games.remove(room.roomId);
      return;
    }
    const [aId, bId] = playerIds;

    let aResult: PlayerResult;
    let bResult: PlayerResult;

    if (reason === 'disconnect' && loserId) {
      // 断线判负：弃赛方 won=false 且 accuracy=0
      const loserIsA = loserId === aId;
      aResult = buildResultForDisconnect(game, aId, !loserIsA);
      bResult = buildResultForDisconnect(game, bId, loserIsA);
    } else {
      // 正常结算或超时：按正确率/时间裁定
      const aFinal = finalizeProgress(game.players.get(aId)!, game.target, game.timeLimitMs, game.startTime);
      const bFinal = finalizeProgress(game.players.get(bId)!, game.target, game.timeLimitMs, game.startTime);
      const winnerFromA = determineWinner(aFinal, bFinal); // 'me'|'opponent'|'draw'（a 视角）
      const aWon = winnerFromA === 'me';
      const bWon = winnerFromA === 'opponent';
      aResult = { playerId: aId, found: aFinal.found, errors: aFinal.errors, accuracy: aFinal.accuracy, timeMs: aFinal.timeMs, done: aFinal.done, won: aWon };
      bResult = { playerId: bId, found: bFinal.found, errors: bFinal.errors, accuracy: bFinal.accuracy, timeMs: bFinal.timeMs, done: bFinal.done, won: bWon };
    }

    // 给双方发 game:end（各自「我」视角）
    emitGameEndTo(aId, aResult, bResult);
    emitGameEndTo(bId, bResult, aResult);

    // 清理游戏 + 房间回 waiting/ready（可重开）
    games.remove(room.roomId);
    const newState = nextWaitingState(room);
    // playing → finished → newState（finished 是过渡态，直接到 newState）
    room.state = 'finished';
    if (canTransition('finished', newState)) {
      room.state = newState;
    }
    broadcastRoomState(io, room);
    const pub = toPublicRoom(room);
    if (pub) lobby.broadcastRoomAdded(pub);
  }

  // 断线判负的结果：弃赛方 accuracy=0 won=false
  function buildResultForDisconnect(game: RoomGame, playerId: string, won: boolean): PlayerResult {
    const prog = game.players.get(playerId)!;
    const final = finalizeProgress(prog, game.target, game.timeLimitMs, game.startTime);
    return {
      playerId,
      found: final.found,
      errors: final.errors,
      accuracy: won ? final.accuracy : 0,
      timeMs: final.timeMs,
      done: final.done,
      won,
    };
  }

  // 给某玩家发 game:end（带「我」视角）
  function emitGameEndTo(viewerId: string, myResult: PlayerResult, opponentResult: PlayerResult): void {
    const winner: 'me' | 'opponent' | 'draw' = myResult.won ? 'me' : (opponentResult.won ? 'opponent' : 'draw');
    const payload: GameEndPayload = { winner, myResult, opponentResult };
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

// 玩家离开/断线：从房间移除，处理房主转让、状态回退、空房销毁
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

  // 房主走了，转让给剩下第一人
  if (room.hostId === userId) {
    const newHost = room.players[0];
    newHost.isHost = true;
    room.hostId = newHost.id;
    room.name = makeRoomName(newHost.name);
  }

  // 状态回退到 waiting（人少了）
  const newState = nextWaitingState(room);
  if (canTransition(room.state, newState)) room.state = newState;
  broadcastRoomState(io, room);

  const pub = toPublicRoom(room);
  if (pub && wasPublic) lobby.broadcastRoomChanged(pub);
  // 如果房间从可见变不可见（理论上 waiting/ready 都可见，这里 pub 不会 null）
}
