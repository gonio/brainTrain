// 暗瓶对战引擎。6 瓶，目标排列服务端生成，初始排列服务端生成（双方相同），先排对者赢。
import type { GameEngine, GameSeed, PlayerProgress, GameAction, FinalizedProgress } from './types.js';

const BOTTLE_COUNT = 6;
const TIME_LIMIT_MS = 180000;

// 9 色 id（与前端 BottleGame.tsx BOTTLE_COLORS 一致）
export const BOTTLE_COLOR_IDS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'cyan', 'pink', 'brown'];

function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// 数位置匹配数
function countMatches(target: string[], player: string[]): number {
  let m = 0;
  for (let i = 0; i < target.length; i++) {
    if (player[i] === target[i]) m++;
  }
  return m;
}

type BottleProgress = Extract<PlayerProgress, { mode: 'bottle' }>;
type BottleSeed = Extract<GameSeed, { mode: 'bottle' }>;

export const bottleEngine: GameEngine = {
  mode: 'bottle',
  timeLimitMs: TIME_LIMIT_MS,
  shouldEndWhenAnyDone: true,

  generateSeed(): BottleSeed {
    const colors = BOTTLE_COLOR_IDS.slice(0, BOTTLE_COUNT);
    const targetSequence = shuffle(colors);
    let initialSequence = shuffle(colors);
    // 保证不全同（至少错一位）
    while (countMatches(targetSequence, initialSequence) === BOTTLE_COUNT) {
      initialSequence = shuffle(colors);
    }
    return { mode: 'bottle', targetSequence, initialSequence };
  },

  createProgress(): BottleProgress {
    return { mode: 'bottle', playerSequence: [], matched: 0, done: false, finishTime: null };
  },

  applyAction(progress: PlayerProgress, action: GameAction, seed: GameSeed, _startTime: number, now: number) {
    if (progress.mode !== 'bottle' || action.mode !== 'bottle' || seed.mode !== 'bottle') {
      return { progress, finished: false };
    }
    if (progress.done) return { progress, finished: false };
    const matched = countMatches(seed.targetSequence, action.playerSequence);
    const done = matched === seed.targetSequence.length;
    return {
      progress: {
        ...progress,
        playerSequence: action.playerSequence,
        matched,
        done,
        finishTime: done ? now : null,
      },
      finished: done,
    };
  },

  finalize(progress: PlayerProgress, seed: GameSeed, startTime: number, endTime: number): FinalizedProgress {
    if (progress.mode !== 'bottle' || seed.mode !== 'bottle') {
      return { accuracy: 0, timeMs: 0, done: false, detail: {} };
    }
    const matched = progress.done ? seed.targetSequence.length : progress.matched;
    const timeMs = progress.done && progress.finishTime !== null
      ? progress.finishTime - startTime
      : endTime - startTime;
    return {
      accuracy: matched / seed.targetSequence.length,
      timeMs,
      done: progress.done,
      detail: { matched, total: seed.targetSequence.length },
    };
  },

  computePercent(progress: PlayerProgress, seed: GameSeed): number {
    if (progress.mode !== 'bottle' || seed.mode !== 'bottle') return 0;
    return Math.round((progress.matched / seed.targetSequence.length) * 100);
  },
};
