// 多人对战房间/游戏状态 store。socket 事件 → action → 状态。
// lobbyRooms 也存在这里，跨页面共享（解决返回大厅后列表消失问题）。
import { create } from 'zustand';
import type {
  RoomStatePayload, GameStartPayload, GameProgressPayload,
  GameEndPayload, MatchFoundPayload, VersusPlayer, RoomState, PublicRoom,
} from '../types/versus';

export type VersusView = 'lobby' | 'ready' | 'countdown' | 'playing' | 'result';

interface RoomSnapshot {
  roomId: string;
  name: string;
  state: RoomState;
  players: VersusPlayer[];
  gameMode: string;
}

interface VersusRoomState {
  view: VersusView;
  room: RoomSnapshot | null;
  matchedRoomId: string | null;
  countdown: number | null;
  gameData: GameStartPayload | null;
  progress: GameProgressPayload | null;
  endResult: GameEndPayload | null;
  error: string | null;
  // 大厅公开房间列表（跨页面共享，由 versusSocketSession 维护）
  lobbyRooms: PublicRoom[];
  connected: boolean;

  setRoomState: (payload: RoomStatePayload) => void;
  setCountdown: (remaining: number) => void;
  onMatchFound: (payload: MatchFoundPayload) => void;
  onGameStart: (payload: GameStartPayload) => void;
  onGameProgress: (payload: GameProgressPayload) => void;
  onGameEnd: (payload: GameEndPayload) => void;
  setError: (msg: string | null) => void;
  setView: (v: VersusView) => void;
  setConnected: (c: boolean) => void;
  // lobby 列表操作
  setLobbyRooms: (rooms: PublicRoom[]) => void;
  addLobbyRoom: (room: PublicRoom) => void;
  updateLobbyRoom: (room: PublicRoom) => void;
  removeLobbyRoom: (roomId: string) => void;
  reset: () => void;
}

function stateToView(state: RoomState): VersusView {
  if (state === 'waiting' || state === 'ready') return 'ready';
  if (state === 'countdown') return 'countdown';
  if (state === 'playing') return 'playing';
  return 'ready';
}

export const useVersusRoomStore = create<VersusRoomState>((set) => ({
  view: 'lobby',
  room: null,
  matchedRoomId: null,
  countdown: null,
  gameData: null,
  progress: null,
  endResult: null,
  error: null,
  lobbyRooms: [],
  connected: false,

  setRoomState: (payload) => set((s) => ({
    room: {
      roomId: payload.roomId,
      name: payload.name,
      state: payload.state,
      players: payload.players,
      gameMode: payload.gameMode,
    },
    // 结果页期间不覆盖 view（避免 endGame 后的 room:state 把结果页打回 ready 导致循环）
    view: s.view === 'result' ? s.view : stateToView(payload.state),
  })),

  setCountdown: (remaining) => set({ countdown: remaining, view: 'countdown' }),

  onMatchFound: (payload) => set({ matchedRoomId: payload.roomId }),

  onGameStart: (payload) => set({ gameData: payload, view: 'playing', progress: null }),

  onGameProgress: (payload) => set({ progress: payload }),

  onGameEnd: (payload) => set({ endResult: payload, view: 'result' }),

  setError: (msg) => set({ error: msg }),
  setView: (v) => set({ view: v }),
  setConnected: (c) => set({ connected: c }),

  setLobbyRooms: (rooms) => set({ lobbyRooms: rooms }),
  addLobbyRoom: (room) => set((s) => ({ lobbyRooms: [...s.lobbyRooms, room] })),
  updateLobbyRoom: (room) => set((s) => ({ lobbyRooms: s.lobbyRooms.map((r) => r.roomId === room.roomId ? room : r) })),
  removeLobbyRoom: (roomId) => set((s) => ({ lobbyRooms: s.lobbyRooms.filter((r) => r.roomId !== roomId) })),

  reset: () => set({
    view: 'lobby', room: null, matchedRoomId: null, countdown: null,
    gameData: null, progress: null, endResult: null, error: null,
  }),
}));

