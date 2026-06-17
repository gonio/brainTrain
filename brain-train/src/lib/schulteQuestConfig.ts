import type { SchulteQuestLevelConfig } from '../types';

// 10 关配置（spec §4.1）
export const SCHULTE_QUEST_LEVELS: readonly SchulteQuestLevelConfig[] = [
  { level: 1,  gridSize: 3, direction: 'asc',                            lives: 3, comboTarget: 8 },
  { level: 2,  gridSize: 4, direction: 'asc',                            lives: 3, comboTarget: 10 },
  { level: 3,  gridSize: 4, direction: 'desc',                           lives: 3, comboTarget: 12 },
  { level: 4,  gridSize: 5, direction: 'asc',                            lives: 3, comboTarget: 15 },
  { level: 5,  gridSize: 5, direction: 'desc',       timeLimitPerNumber: 5, lives: 3, comboTarget: 18 },
  { level: 6,  gridSize: 5, direction: 'alternate',  timeLimitPerNumber: 5, lives: 3, comboTarget: 20 },
  { level: 7,  gridSize: 5, direction: 'alternate',  timeLimitPerNumber: 4, lives: 2, comboTarget: 22 },
  { level: 8,  gridSize: 6, direction: 'asc',        timeLimitPerNumber: 4, lives: 2, comboTarget: 25 },
  { level: 9,  gridSize: 6, direction: 'desc',       timeLimitPerNumber: 3, lives: 1, comboTarget: 28 },
  { level: 10, gridSize: 6, direction: 'mixed',      timeLimitPerNumber: 3, lives: 1, comboTarget: 30 },
] as const;

// Combo 倍率表（spec §4.3）
export const COMBO_MULTIPLIER_TABLE = [
  { minCombo: 0,  multiplier: 1.0 },
  { minCombo: 5,  multiplier: 1.5 },
  { minCombo: 10, multiplier: 2.0 },
  { minCombo: 20, multiplier: 3.0 },
  { minCombo: 50, multiplier: 5.0 },
] as const;

// 根据 combo 数查倍率
export function computeComboMultiplier(combo: number): number {
  let multiplier = 1.0;
  for (const entry of COMBO_MULTIPLIER_TABLE) {
    if (combo >= entry.minCombo) multiplier = entry.multiplier;
  }
  return multiplier;
}

// 星级判定（spec §4.4）
export function computeStars(args: {
  passed: boolean;
  maxCombo: number;
  errorCount: number;
  comboTarget: number;
}): 0 | 1 | 2 | 3 {
  const { passed, maxCombo, errorCount, comboTarget } = args;
  if (!passed) return 0;
  let stars: 0 | 1 | 2 | 3 = 1;
  if (maxCombo >= comboTarget) stars++;
  if (errorCount === 0) stars++;
  return Math.min(3, stars) as 0 | 1 | 2 | 3;
}

// 得分计算（spec §4.5）
export function computeScore(args: {
  level: number;
  timeLimitPerNumber?: number;
  maxCombo: number;
  remainingTime: number;
}): number {
  const { level, timeLimitPerNumber, maxCombo, remainingTime } = args;
  const baseScore = 100 * level;
  const timeBonus = timeLimitPerNumber ? remainingTime * 5 : 0;
  const multiplier = computeComboMultiplier(maxCombo);
  return Math.round((baseScore + timeBonus) * multiplier);
}

// 确定性伪随机数（mulberry32 算法）
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// mixed 方向的固定序列生成（spec §4.2）
export function generateMixedSequence(gridSize: number, startTime: number): number[] {
  const N = gridSize * gridSize;
  const seed = startTime % 4294967296;
  const rng = mulberry32(seed);
  const arr = Array.from({ length: N }, (_, i) => i + 1);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 根据关卡 level 获取配置
export function getLevelConfig(level: number): SchulteQuestLevelConfig | undefined {
  return SCHULTE_QUEST_LEVELS.find((l) => l.level === level);
}
