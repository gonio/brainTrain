// 舒尔特对战引擎：迁移自 src/schulte/schulteGame.ts + 新增 direction。
import type { GameEngine, GameSeed, PlayerProgress, GameAction, FinalizedProgress } from './types.js';

const GRID_SIZE = 5;
const TIME_LIMIT_MS = 90000;

type SchulteProgress = Extract<PlayerProgress, { mode: 'schulte' }>;
type SchulteSeed = Extract<GameSeed, { mode: 'schulte' }>;
type SchulteAction = Extract<GameAction, { mode: 'schulte' }>;

// Fisher-Yates 洗牌
function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function generateGrid(size: number): number[] {
  const n = size * size;
  return shuffle(Array.from({ length: n }, (_, i) => i + 1));
}

// 按 direction 算「要点顺序」
function buildOrder(direction: 'forward' | 'reverse' | 'random', target: number): number[] {
  if (direction === 'forward') return Array.from({ length: target }, (_, i) => i + 1);
  if (direction === 'reverse') return Array.from({ length: target }, (_, i) => target - i);
  // random：1..target 的随机排列
  return shuffle(Array.from({ length: target }, (_, i) => i + 1));
}

export const schulteEngine: GameEngine = {
  mode: 'schulte',
  timeLimitMs: TIME_LIMIT_MS,
  shouldEndWhenAnyDone: true,

  generateSeed(): SchulteSeed {
    const grid = generateGrid(GRID_SIZE);
    const target = grid.length;
    const directions = ['forward', 'reverse', 'random'] as const;
    const direction = directions[Math.floor(Math.random() * directions.length)];
    const order = buildOrder(direction, target);
    return { mode: 'schulte', grid, size: GRID_SIZE, target, direction, order };
  },

  createProgress(): SchulteProgress {
    return { mode: 'schulte', found: 0, errors: 0, done: false, finishTime: null };
  },

  applyAction(progress: PlayerProgress, action: GameAction, seed: GameSeed, _startTime: number, now: number) {
    if (progress.mode !== 'schulte' || action.mode !== 'schulte' || seed.mode !== 'schulte') {
      return { progress, finished: false };
    }
    if (progress.done) return { progress, finished: false };
    const expected = seed.order[progress.found]; // 当前该点的数
    if (action.cellIndex < 0 || action.cellIndex >= seed.grid.length) {
      return { progress: { ...progress, errors: progress.errors + 1 }, finished: false };
    }
    const tapped = seed.grid[action.cellIndex];
    if (tapped === expected) {
      const newFound = progress.found + 1;
      const done = newFound === seed.target;
      return {
        progress: { ...progress, found: newFound, done, finishTime: done ? now : null },
        finished: done,
      };
    }
    return { progress: { ...progress, errors: progress.errors + 1 }, finished: false };
  },

  finalize(progress: PlayerProgress, seed: GameSeed, startTime: number, endTime: number): FinalizedProgress {
    if (progress.mode !== 'schulte' || seed.mode !== 'schulte') {
      return { accuracy: 0, timeMs: 0, done: false, detail: {} };
    }
    const unfilled = progress.done ? 0 : (seed.target - progress.found);
    const finalErrors = progress.errors + unfilled;
    const timeMs = progress.done && progress.finishTime !== null
      ? progress.finishTime - startTime
      : endTime - startTime;
    const denom = progress.found + finalErrors;
    const accuracy = denom === 0 ? 0 : progress.found / denom;
    return {
      accuracy,
      timeMs,
      done: progress.done,
      detail: { found: progress.found, errors: finalErrors },
    };
  },

  computePercent(progress: PlayerProgress, seed: GameSeed): number {
    if (progress.mode !== 'schulte' || seed.mode !== 'schulte') return 0;
    return Math.round((progress.found / seed.target) * 100);
  },
};
