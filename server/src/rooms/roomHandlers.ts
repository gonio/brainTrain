// 房间事件编排：注册所有 B 阶段 Socket.IO 事件处理器。
import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { Room, Player } from '../types/room.js';
import { createRoomStore } from './roomStore.js';
import { createLobbyService } from './lobbyService.js';
import { createMatchService } from './matchService.js';
import { canTransition, nextWaitingState } from './roomStateMachine.js';
import { toPublicRoom, isFull, allReady, toRoomStatePayload, makeRoomName } from './roomHelpers.js';

const COUNTDOWN_SECONDS = 3;
const MATCH_TIMEOUT_MS = 30000;

export function attachRoomHandlers(io: SocketIOServer): void {
  const store = createRoomStore();
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
          // 计划二占位：countdown 结束回 ready（计划三改为进 playing + game:start）
          if (canTransition('countdown', 'ready')) {
            room.state = 'ready';
            broadcastRoomState(io, room);
            const pub = toPublicRoom(room);
            if (pub) lobby.broadcastRoomAdded(pub);
          }
        }
      }, 1000);
    });

    // ===== 断线 =====
    socket.on('disconnect', () => {
      lobby.unsubscribe(socket.id);
      match.cancel(userId);
      removePlayer(io, socket, store, lobby, userId);
    });
  });
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
