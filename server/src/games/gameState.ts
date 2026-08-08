// 通用对局状态（取代 schulte 专属的 RoomGame）。每局开始创建，结束删除。
import type { GameMode } from '../types/room.js';
import type { GameSeed, PlayerProgress } from './types.js';

export interface VersusGame {
  roomId: string;
  mode: GameMode;
  seed: GameSeed;
  startTime: number;
  timeLimitMs: number;
  players: Map<string, PlayerProgress>;
  ended: boolean;
  // 字色宽限倒计时状态
  graceTimerStarted: boolean;
}

const games = new Map<string, VersusGame>();

export const gameState = {
  create(g: Omit<VersusGame, 'ended' | 'graceTimerStarted'>): VersusGame {
    const game: VersusGame = { ...g, ended: false, graceTimerStarted: false };
    games.set(g.roomId, game);
    return game;
  },
  get(roomId: string): VersusGame | undefined {
    return games.get(roomId);
  },
  updateProgress(roomId: string, playerId: string, progress: PlayerProgress): boolean {
    const g = games.get(roomId);
    if (!g) return false;
    g.players.set(playerId, progress);
    return true;
  },
  markEnded(roomId: string): void {
    const g = games.get(roomId);
    if (g) g.ended = true;
  },
  remove(roomId: string): void {
    games.delete(roomId);
  },
};
