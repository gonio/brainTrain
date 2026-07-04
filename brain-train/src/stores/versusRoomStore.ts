// 多人对战房间/游戏状态 store。socket 事件 → action → 状态。
import { create } from 'zustand';
import type {
  RoomStatePayload, GameStartPayload, GameProgressPayload,
  GameEndPayload, MatchFoundPayload, VersusPlayer, RoomState,
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

  setRoomState: (payload: RoomStatePayload) => void;
  setCountdown: (remaining: number) => void;
  onMatchFound: (payload: MatchFoundPayload) => void;
  onGameStart: (payload: GameStartPayload) => void;
  onGameProgress: (payload: GameProgressPayload) => void;
  onGameEnd: (payload: GameEndPayload) => void;
  setError: (msg: string | null) => void;
  setView: (v: VersusView) => void;
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

  setRoomState: (payload) => set({
    room: {
      roomId: payload.roomId,
      name: payload.name,
      state: payload.state,
      players: payload.players,
      gameMode: payload.gameMode,
    },
    view: stateToView(payload.state),
  }),

  setCountdown: (remaining) => set({ countdown: remaining, view: 'countdown' }),

  onMatchFound: (payload) => set({ matchedRoomId: payload.roomId }),

  onGameStart: (payload) => set({ gameData: payload, view: 'playing', progress: null }),

  onGameProgress: (payload) => set({ progress: payload }),

  onGameEnd: (payload) => set({ endResult: payload, view: 'result' }),

  setError: (msg) => set({ error: msg }),
  setView: (v) => set({ view: v }),

  reset: () => set({
    view: 'lobby', room: null, matchedRoomId: null, countdown: null,
    gameData: null, progress: null, endResult: null, error: null,
  }),
}));
