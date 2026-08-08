import { describe, it, expect, beforeEach } from 'vitest';
import { useVersusRoomStore } from '../../src/stores/versusRoomStore';
import type {
  RoomStatePayload, VersusGameStart, VersusGameProgress, VersusGameEnd, MatchFoundPayload, GameMode,
} from '../../src/types/versus';

beforeEach(() => {
  useVersusRoomStore.getState().reset();
});

const baseRoomState = {
  roomId: 'r1', name: '测试房',
  players: [
    { id: 'me', name: '我', avatar: '🦊', ready: true, isHost: true, connected: true },
    { id: 'op', name: '对手', avatar: '🐰', ready: true, isHost: false, connected: true },
  ],
  gameMode: 'schulte' as const,
  roundMode: 'single' as const,
  gameQueue: ['schulte'] as GameMode[],
  currentQueueIndex: 0,
  totalInRound: 1,
  hostCanChangeGames: false,
  roundResults: [],
};

describe('versusRoomStore', () => {
  it('初始状态：无房间、view=lobby', () => {
    const s = useVersusRoomStore.getState();
    expect(s.room).toBeNull();
    expect(s.view).toBe('lobby');
    expect(s.gameData).toBeNull();
  });

  it('setRoomState 更新房间 + 自动切 view', () => {
    const payload: RoomStatePayload = { ...baseRoomState, state: 'ready' };
    useVersusRoomStore.getState().setRoomState(payload);
    const s = useVersusRoomStore.getState();
    expect(s.room?.roomId).toBe('r1');
    expect(s.view).toBe('ready');
  });

  it('setRoomState 收到 playing → view=playing', () => {
    useVersusRoomStore.getState().setRoomState({ ...baseRoomState, state: 'playing', players: [] });
    expect(useVersusRoomStore.getState().view).toBe('playing');
  });

  it('setCountdown → view=countdown', () => {
    useVersusRoomStore.getState().setCountdown(3);
    expect(useVersusRoomStore.getState().view).toBe('countdown');
    expect(useVersusRoomStore.getState().countdown).toBe(3);
  });

  it('onMatchFound 设置房间 id', () => {
    const payload: MatchFoundPayload = { roomId: 'r1', opponent: { id: 'op', name: '对手', avatar: '🐰' } };
    useVersusRoomStore.getState().onMatchFound(payload);
    expect(useVersusRoomStore.getState().matchedRoomId).toBe('r1');
  });

  it('onGameStart 设置 gameData + view=playing', () => {
    const payload: VersusGameStart = {
      mode: 'schulte',
      seed: { mode: 'schulte', grid: [1, 2, 3], size: 5, target: 25, direction: 'forward', order: [1, 2, 3] },
      startTime: 1000, timeLimitMs: 90000, queueIndex: 0, totalInRound: 1,
    };
    useVersusRoomStore.getState().onGameStart(payload);
    const s = useVersusRoomStore.getState();
    expect(s.gameData?.mode).toBe('schulte');
    expect(s.view).toBe('playing');
  });

  it('onGameProgress 更新进度', () => {
    const payload: VersusGameProgress = {
      mode: 'schulte',
      me: { percent: 20, done: false },
      opponent: { percent: 12, done: false },
    };
    useVersusRoomStore.getState().onGameProgress(payload);
    expect(useVersusRoomStore.getState().progress).toEqual(payload);
  });

  it('onGameEnd 设置结果 + view=result', () => {
    const payload: VersusGameEnd = {
      winner: 'me',
      myResult: { playerId: 'me', found: 25, errors: 0, accuracy: 1, timeMs: 30000, done: true, won: true },
      opponentResult: { playerId: 'op', found: 0, errors: 25, accuracy: 0, timeMs: 90000, done: false, won: false },
    };
    useVersusRoomStore.getState().onGameEnd(payload);
    const s = useVersusRoomStore.getState();
    expect(s.endResult?.winner).toBe('me');
    expect(s.view).toBe('result');
  });

  it('reset 清空所有', () => {
    useVersusRoomStore.getState().onGameProgress({
      mode: 'schulte',
      me: { percent: 4, done: false }, opponent: { percent: 0, done: false },
    });
    useVersusRoomStore.getState().reset();
    expect(useVersusRoomStore.getState().progress).toBeNull();
    expect(useVersusRoomStore.getState().room).toBeNull();
    expect(useVersusRoomStore.getState().view).toBe('lobby');
  });
});
