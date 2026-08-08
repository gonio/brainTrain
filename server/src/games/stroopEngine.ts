// 字色对战引擎。题目服务端生成（70% 干扰 / 30% 一致），每题 rule 三选一随机。
import type { GameEngine, GameSeed, PlayerProgress, GameAction, FinalizedProgress, StroopQuestionDef } from './types.js';

const QUESTION_COUNT = 10;
const TIME_PER_QUESTION_SEC = 8;
const FINISH_GRACE_SEC = 10;
const TIME_LIMIT_MS = 120000;  // 整体上限兜底

export interface StroopColor { name: string; value: string; }

// 6 色（与前端 StroopGame.tsx COLORS 一致，只保留 name + value）
export const STROOP_COLORS: StroopColor[] = [
  { name: '红色', value: '#ef4444' },
  { name: '蓝色', value: '#3b82f6' },
  { name: '绿色', value: '#22c55e' },
  { name: '黄色', value: '#eab308' },
  { name: '紫色', value: '#a855f7' },
  { name: '橙色', value: '#f97316' },
];

function randomColor(): StroopColor {
  return STROOP_COLORS[Math.floor(Math.random() * STROOP_COLORS.length)];
}

// 生成单题：70% 概率干扰（word≠wordColor），30% 一致
function generateQuestion(): StroopQuestionDef {
  const rule: 'standard' | 'reverse' = Math.random() < 0.5 ? 'standard' : 'reverse';
  const wordColor = randomColor();
  let displayColor = randomColor();
  if (Math.random() < 0.7) {
    while (displayColor.name === wordColor.name) displayColor = randomColor();
  } else {
    displayColor = wordColor;
  }
  // word = 字面含义（wordColor.name），wordColor = 实际显示颜色（displayColor.name）
  const correctAnswer = rule === 'standard' ? displayColor.name : wordColor.name;
  return { word: wordColor.name, wordColor: displayColor.name, correctAnswer, rule };
}

type StroopProgress = Extract<PlayerProgress, { mode: 'stroop' }>;
type StroopSeed = Extract<GameSeed, { mode: 'stroop' }>;

export const stroopEngine: GameEngine = {
  mode: 'stroop',
  timeLimitMs: TIME_LIMIT_MS,
  shouldEndWhenAnyDone: false,

  generateSeed(): StroopSeed {
    const questions = Array.from({ length: QUESTION_COUNT }, () => generateQuestion());
    return { mode: 'stroop', questions, timePerQuestionSec: TIME_PER_QUESTION_SEC, finishGraceSec: FINISH_GRACE_SEC };
  },

  createProgress(): StroopProgress {
    return { mode: 'stroop', answered: 0, correct: 0, errors: 0, done: false, finishTime: null };
  },

  applyAction(progress: PlayerProgress, action: GameAction, seed: GameSeed, _startTime: number, now: number) {
    if (progress.mode !== 'stroop' || action.mode !== 'stroop' || seed.mode !== 'stroop') {
      return { progress, finished: false };
    }
    if (progress.done) return { progress, finished: false };
    const q = seed.questions[action.questionIndex];
    if (!q) return { progress, finished: false };
    const isCorrect = action.answer === q.correctAnswer;
    const newAnswered = progress.answered + 1;
    const done = newAnswered >= seed.questions.length;
    return {
      progress: {
        ...progress,
        answered: newAnswered,
        correct: progress.correct + (isCorrect ? 1 : 0),
        errors: progress.errors + (isCorrect ? 0 : 1),
        done,
        finishTime: done ? now : null,
      },
      finished: done,
    };
  },

  finalize(progress: PlayerProgress, _seed: GameSeed, startTime: number, endTime: number): FinalizedProgress {
    if (progress.mode !== 'stroop') return { accuracy: 0, timeMs: 0, done: false, detail: {} };
    const timeMs = progress.done && progress.finishTime !== null
      ? progress.finishTime - startTime
      : endTime - startTime;
    const accuracy = progress.answered === 0 ? 0 : progress.correct / QUESTION_COUNT;
    return {
      accuracy,
      timeMs,
      done: progress.done,
      detail: { answered: progress.answered, correct: progress.correct, errors: progress.errors },
    };
  },

  computePercent(progress: PlayerProgress, _seed: GameSeed): number {
    if (progress.mode !== 'stroop') return 0;
    return Math.round((progress.answered / QUESTION_COUNT) * 100);
  },
};
