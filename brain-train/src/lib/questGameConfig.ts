// 主线闯关难度参数表：4 游戏 × 10 级
// 详见 spec: docs/superpowers/specs/2026-06-24-quest-mode-design.md §4

import type {
  DifficultyLevel,
  SchulteDifficultyParams,
  SequenceDifficultyParams,
  StroopDifficultyParams,
  BottleDifficultyParams,
  GameId,
} from '@/types/quest';

// ── Schulte 舒尔特（10 级，复用现有闯关体系） ──
// comboTarget/星级阈值沿用现有 schulteQuestConfig 的曲线
export const SCHULTE_DIFFICULTIES: readonly DifficultyLevel<SchulteDifficultyParams>[] = [
  { difficulty: 1,  params: { gridSize: 3, direction: 'asc',                               lives: 3 }, comboTarget: 8,  goodThreshold: 8,  excellentThreshold: 12 },
  { difficulty: 2,  params: { gridSize: 4, direction: 'asc',                               lives: 3 }, comboTarget: 10, goodThreshold: 10, excellentThreshold: 15 },
  { difficulty: 3,  params: { gridSize: 4, direction: 'desc',                              lives: 3 }, comboTarget: 12, goodThreshold: 12, excellentThreshold: 18 },
  { difficulty: 4,  params: { gridSize: 5, direction: 'asc',                               lives: 3 }, comboTarget: 15, goodThreshold: 15, excellentThreshold: 22 },
  { difficulty: 5,  params: { gridSize: 5, direction: 'desc',     timeLimitPerNumber: 5, lives: 3 }, comboTarget: 18, goodThreshold: 18, excellentThreshold: 25 },
  { difficulty: 6,  params: { gridSize: 5, direction: 'alternate', timeLimitPerNumber: 6, lives: 3 }, comboTarget: 18, goodThreshold: 18, excellentThreshold: 25 },
  { difficulty: 7,  params: { gridSize: 5, direction: 'alternate', timeLimitPerNumber: 5, lives: 2 }, comboTarget: 20, goodThreshold: 20, excellentThreshold: 28 },
  { difficulty: 8,  params: { gridSize: 6, direction: 'desc',     timeLimitPerNumber: 4, lives: 2 }, comboTarget: 25, goodThreshold: 25, excellentThreshold: 35 },
  { difficulty: 9,  params: { gridSize: 6, direction: 'mixed',    timeLimitPerNumber: 3, lives: 2 }, comboTarget: 28, goodThreshold: 28, excellentThreshold: 40 },
  { difficulty: 10, params: { gridSize: 6, direction: 'mixed',    timeLimitPerNumber: 3, lives: 1 }, comboTarget: 30, goodThreshold: 30, excellentThreshold: 45 },
];

// ── Sequence 序列记忆（10 级） ──
// 难度梯度：先 step（逐个亮起，易记）→ flash（整段闪现，难记）→ 加干扰项 → 加回答限时
export const SEQUENCE_DIFFICULTIES: readonly DifficultyLevel<SequenceDifficultyParams>[] = [
  { difficulty: 1,  params: { sequenceLength: 4,  displayMode: 'step',  distractors: 0 }, goodThreshold: 80, excellentThreshold: 95 },
  { difficulty: 2,  params: { sequenceLength: 5,  displayMode: 'step',  distractors: 0 }, goodThreshold: 80, excellentThreshold: 95 },
  { difficulty: 3,  params: { sequenceLength: 6,  displayMode: 'step',  distractors: 0 }, goodThreshold: 80, excellentThreshold: 95 },
  { difficulty: 4,  params: { sequenceLength: 6,  displayMode: 'flash', distractors: 0 }, goodThreshold: 80, excellentThreshold: 95 },
  { difficulty: 5,  params: { sequenceLength: 7,  displayMode: 'flash', distractors: 0 }, goodThreshold: 80, excellentThreshold: 95 },
  { difficulty: 6,  params: { sequenceLength: 7,  displayMode: 'flash', distractors: 1 }, goodThreshold: 75, excellentThreshold: 90 },
  { difficulty: 7,  params: { sequenceLength: 8,  displayMode: 'flash', distractors: 2 }, goodThreshold: 75, excellentThreshold: 90 },
  { difficulty: 8,  params: { sequenceLength: 9,  displayMode: 'flash', distractors: 2 }, goodThreshold: 70, excellentThreshold: 85 },
  { difficulty: 9,  params: { sequenceLength: 10, displayMode: 'flash', distractors: 3 }, goodThreshold: 70, excellentThreshold: 85 },
  { difficulty: 10, params: { sequenceLength: 10, displayMode: 'flash', distractors: 3, answerTimeLimit: 20 }, goodThreshold: 65, excellentThreshold: 80 },
];

// ── Stroop 斯特鲁普（10 级） ──
// 难度梯度：加题数 → reverse → dual（每题随机规则）→ 加每题限时
export const STROOP_DIFFICULTIES: readonly DifficultyLevel<StroopDifficultyParams>[] = [
  { difficulty: 1,  params: { questionCount: 10, mode: 'standard' },                   goodThreshold: 80, excellentThreshold: 95 },
  { difficulty: 2,  params: { questionCount: 12, mode: 'standard' },                   goodThreshold: 80, excellentThreshold: 95 },
  { difficulty: 3,  params: { questionCount: 15, mode: 'standard' },                   goodThreshold: 80, excellentThreshold: 95 },
  { difficulty: 4,  params: { questionCount: 15, mode: 'reverse' },                    goodThreshold: 75, excellentThreshold: 90 },
  { difficulty: 5,  params: { questionCount: 15, mode: 'dual' },                       goodThreshold: 70, excellentThreshold: 85 },
  { difficulty: 6,  params: { questionCount: 18, mode: 'dual' },                       goodThreshold: 70, excellentThreshold: 85 },
  { difficulty: 7,  params: { questionCount: 20, mode: 'dual' },                       goodThreshold: 70, excellentThreshold: 85 },
  { difficulty: 8,  params: { questionCount: 20, mode: 'dual', timePerQuestion: 3 },   goodThreshold: 65, excellentThreshold: 80 },
  { difficulty: 9,  params: { questionCount: 20, mode: 'dual', timePerQuestion: 2 },   goodThreshold: 60, excellentThreshold: 75 },
  { difficulty: 10, params: { questionCount: 20, mode: 'dual', timePerQuestion: 2 },   goodThreshold: 55, excellentThreshold: 70 },
];

// ── Bottle 暗瓶排列（10 级） ──
// 星级阈值用「步数倍率」语义：goodThreshold=1.5 表示 swaps ≤ optimal×1.5 得 2 星；
// excellentThreshold=1.0 表示 swaps ≤ optimal 得 3 星。
export const BOTTLE_DIFFICULTIES: readonly DifficultyLevel<BottleDifficultyParams>[] = [
  { difficulty: 1,  params: { bottleCount: 4 },                 goodThreshold: 1.5, excellentThreshold: 1.0 },
  { difficulty: 2,  params: { bottleCount: 5 },                 goodThreshold: 1.5, excellentThreshold: 1.0 },
  { difficulty: 3,  params: { bottleCount: 6 },                 goodThreshold: 1.5, excellentThreshold: 1.0 },
  { difficulty: 4,  params: { bottleCount: 6, timeLimit: 90 },  goodThreshold: 1.5, excellentThreshold: 1.0 },
  { difficulty: 5,  params: { bottleCount: 7, timeLimit: 90 },  goodThreshold: 1.5, excellentThreshold: 1.0 },
  { difficulty: 6,  params: { bottleCount: 7, timeLimit: 60 },  goodThreshold: 1.5, excellentThreshold: 1.0 },
  { difficulty: 7,  params: { bottleCount: 8, timeLimit: 60 },  goodThreshold: 1.5, excellentThreshold: 1.0 },
  { difficulty: 8,  params: { bottleCount: 8, timeLimit: 45 },  goodThreshold: 1.5, excellentThreshold: 1.0 },
  { difficulty: 9,  params: { bottleCount: 9, timeLimit: 45 },  goodThreshold: 1.5, excellentThreshold: 1.0 },
  { difficulty: 10, params: { bottleCount: 9, timeLimit: 30 },  goodThreshold: 1.5, excellentThreshold: 1.0 },
];

/** 按 gameId 取难度表（统一为 unknown 参数类型，调用方自行 as 断言） */
export const DIFFICULTY_TABLES: Record<GameId, readonly DifficultyLevel<unknown>[]> = {
  schulte: SCHULTE_DIFFICULTIES,
  sequence: SEQUENCE_DIFFICULTIES,
  stroop: STROOP_DIFFICULTIES,
  bottle: BOTTLE_DIFFICULTIES,
};

/** 取某游戏某难度配置（difficulty 1-10） */
export function getDifficulty(gameId: GameId, difficulty: number): DifficultyLevel<unknown> {
  const table = DIFFICULTY_TABLES[gameId];
  return table[difficulty - 1];
}
