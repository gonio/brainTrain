// 每局对战权威进度存储：Map<roomId, RoomGame>。内存态，不落库。
import type { RoomGame, PlayerProgress } from '../types/schulte.js';

export interface CreateGameInput {
  roomId: string;
  grid: number[];
  startTime: number;
  timeLimitMs: number;
  target: number;
  playerIds: string[];
}

export interface GameStore {
  create(input: CreateGameInput): RoomGame;
  get(roomId: string): RoomGame | null;
  updateProgress(roomId: string, playerId: string, patch: Partial<PlayerProgress>): boolean;
  markEnded(roomId: string): void;
  remove(roomId: string): void;
}

export function createGameStore(): GameStore {
  const games = new Map<string, RoomGame>();

  return {
    create(input) {
      const players = new Map<string, PlayerProgress>();
      for (const pid of input.playerIds) {
        players.set(pid, { playerId: pid, found: 0, errors: 0, done: false, finishTime: null });
      }
      const game: RoomGame = {
        roomId: input.roomId,
        grid: input.grid,
        startTime: input.startTime,
        timeLimitMs: input.timeLimitMs,
        target: input.target,
        players,
        ended: false,
      };
      games.set(input.roomId, game);
      return game;
    },

    get(roomId) {
      return games.get(roomId) ?? null;
    },

    updateProgress(roomId, playerId, patch) {
      const game = games.get(roomId);
      if (!game) return false;
      const prog = game.players.get(playerId);
      if (!prog) return false;
      game.players.set(playerId, { ...prog, ...patch });
      return true;
    },

    markEnded(roomId) {
      const game = games.get(roomId);
      if (game) game.ended = true;
    },

    remove(roomId) {
      games.delete(roomId);
    },
  };
}
