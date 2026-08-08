// 序列记忆对战引擎。序列长度 6，回忆限时 15s，回忆阶段含干扰项。
import type { GameEngine, GameSeed, PlayerProgress, GameAction, FinalizedProgress } from './types.js';

const SEQUENCE_LENGTH = 6;
const MEMORIZE_MS = 4000;
const RECALL_TIME_LIMIT_MS = 15000;
const TIME_LIMIT_MS = MEMORIZE_MS + RECALL_TIME_LIMIT_MS;  // 总上限兜底（含 memorize）

// 12 emoji 物品池（与前端 SequenceGame.tsx ITEMS_POOL 一致）
export const SEQUENCE_ITEM_POOL = [
  '🐶', '🐱', '🐰', '🦊', '🐸', '🐧',
  '🍎', '🍋', '🍇', '🫐', '🍑', '🐝',
];

function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type SequenceProgress = Extract<PlayerProgress, { mode: 'sequence' }>;
type SequenceSeed = Extract<GameSeed, { mode: 'sequence' }>;

export const sequenceEngine: GameEngine = {
  mode: 'sequence',
  timeLimitMs: TIME_LIMIT_MS,
  shouldEndWhenAnyDone: false,

  generateSeed(): SequenceSeed {
    const shuffled = shuffle(SEQUENCE_ITEM_POOL);
    const sequence = shuffled.slice(0, SEQUENCE_LENGTH);
    // 干扰项：池里剩下的随机取 3 个
    const distractors = shuffle(shuffled.slice(SEQUENCE_LENGTH)).slice(0, 3);
    const optionPool = shuffle([...sequence, ...distractors]);
    return { mode: 'sequence', sequence, distractors, optionPool, memorizeMs: MEMORIZE_MS, recallTimeLimitMs: RECALL_TIME_LIMIT_MS };
  },

  createProgress(): SequenceProgress {
    return { mode: 'sequence', submitted: false, userSequence: [], positionCorrect: 0, submitTime: null };
  },

  applyAction(progress: PlayerProgress, action: GameAction, seed: GameSeed, _startTime: number, now: number) {
    if (progress.mode !== 'sequence' || action.mode !== 'sequence' || seed.mode !== 'sequence') {
      return { progress, finished: false };
    }
    if (progress.submitted) return { progress, finished: false };
    // 数位置准确率
    let positionCorrect = 0;
    for (let i = 0; i < seed.sequence.length; i++) {
      if (action.userSequence[i] === seed.sequence[i]) positionCorrect++;
    }
    return {
      progress: {
        ...progress,
        submitted: true,
        userSequence: action.userSequence,
        positionCorrect,
        submitTime: now,
      },
      finished: true,  // 提交即该方完成（但 shouldEndWhenAnyDone=false，要等双方）
    };
  },

  finalize(progress: PlayerProgress, seed: GameSeed, startTime: number, endTime: number): FinalizedProgress {
    if (progress.mode !== 'sequence' || seed.mode !== 'sequence') {
      return { accuracy: 0, timeMs: 0, done: false, detail: {} };
    }
    if (!progress.submitted) {
      // 未提交（超时）：accuracy=0，时间用回忆阶段上限
      return { accuracy: 0, timeMs: RECALL_TIME_LIMIT_MS, done: false, detail: { positionCorrect: 0 } };
    }
    // 回忆用时 = submitTime - recall开始时刻。recall 开始于 startTime + memorizeMs。
    const recallStart = startTime + seed.memorizeMs;
    const timeMs = (progress.submitTime ?? endTime) - recallStart;
    const accuracy = progress.positionCorrect / seed.sequence.length;
    return {
      accuracy,
      timeMs,
      done: true,
      detail: { positionCorrect: progress.positionCorrect, userSequence: progress.userSequence },
    };
  },

  computePercent(progress: PlayerProgress, _seed: GameSeed): number {
    if (progress.mode !== 'sequence') return 0;
    // 序列没有「进行中百分比」——未提交=0，提交=100
    return progress.submitted ? 100 : 0;
  },
};
