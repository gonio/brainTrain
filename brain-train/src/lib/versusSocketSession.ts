// 多人对战 socket 会话：模块级单例，只初始化一次，监听所有事件写进 store。
// 解决页面组件挂载/卸载导致的 listener 时序问题（返回大厅后列表消失、准备无响应）。
// 页面组件只读 store + emit 动作，不再各自管理 listener。
import type { Socket } from 'socket.io-client';
import { connectVersus, getSocket } from './versusSocket';
import { useAuthStore } from '../stores/authStore';
import { useVersusRoomStore } from '../stores/versusRoomStore';
import type {
  PublicRoom, RoomStatePayload, CountdownPayload,
  GameEndPayload, RoomErrorPayload, MatchFoundPayload,
  VersusGameStart, VersusGameProgress,
  NextRoundPayload, RoundEndPayload, GracePayload,
} from '../types/versus';

let initialized = false;

// 初始化对战 socket 会话：建号、连 socket、注册所有事件监听。
// 幂等：多次调用只初始化一次。整个 versus 会话期间 listener 持续存在。
export async function initVersusSession(): Promise<Socket | null> {
  if (initialized) {
    return getSocket();
  }

  await useAuthStore.getState().ensureAuthenticated();
  const token = useAuthStore.getState().token;
  if (!token) return null;

  const socket = connectVersus(token);
  // 确保 socket 连接成功后再继续（subscribe 依赖连接）
  if (!socket.connected) {
    await new Promise<void>((resolve) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', () => resolve()); // 连接失败也继续，不阻塞
    });
  }
  initialized = true;

  const store = useVersusRoomStore.getState;

  // ===== 大厅事件（持续监听，写进 store.lobbyRooms）=====
  socket.on('lobby:list', (list: PublicRoom[]) => store().setLobbyRooms(list));
  socket.on('lobby:roomAdded', (room: PublicRoom) => store().addLobbyRoom(room));
  socket.on('lobby:roomChanged', (room: PublicRoom) => store().updateLobbyRoom(room));
  socket.on('lobby:roomRemoved', ({ roomId }: { roomId: string }) => store().removeLobbyRoom(roomId));
  socket.on('match:found', (payload: MatchFoundPayload) => store().onMatchFound(payload));

  // ===== 房间/游戏事件（写进 store）=====
  socket.on('room:state', (d: RoomStatePayload) => store().setRoomState(d));
  socket.on('room:countdown', (d: CountdownPayload) => store().setCountdown(d.remaining));
  socket.on('game:start', (d: VersusGameStart) => store().onGameStart(d));
  socket.on('game:progress', (d: VersusGameProgress) => store().onGameProgress(d));
  socket.on('game:end', (d: GameEndPayload) => store().onGameEnd(d));
  socket.on('game:grace', (d: GracePayload) => store().setGrace(d.seconds));
  socket.on('room:nextRound', (d: NextRoundPayload) => store().onNextRound(d));
  socket.on('room:roundEnd', (d: RoundEndPayload) => store().onRoundEnd(d));
  socket.on('room:error', (d: RoomErrorPayload) => store().setError(d.message));

  return socket;
}

// 大厅订阅（进入大厅页时调用）。确保 socket 已连接后再 emit。
export function subscribeLobby(): void {
  const socket = getSocket();
  if (!socket) return;
  if (socket.connected) {
    socket.emit('lobby:subscribe');
  } else {
    // 还没连上，等连接成功后再订阅（只订阅一次）
    const handler = () => {
      socket.emit('lobby:subscribe');
      socket.off('connect', handler);
    };
    socket.on('connect', handler);
  }
}

// 大厅退订（离开大厅页时调用）
export function unsubscribeLobby(): void {
  getSocket()?.emit('lobby:unsubscribe');
}
