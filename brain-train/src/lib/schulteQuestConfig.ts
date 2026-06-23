import type { SchulteQuestLevelConfig } from '../types';
import { seededShuffle, mulberry32 } from './rng';

// 10 关配置
// 交替关（6/7/8）从 3×3→4×4→5×5 渐进：小格起步，玩家先熟悉「看方向、随机段长翻转」的新玩法
export const SCHULTE_QUEST_LEVELS: readonly SchulteQuestLevelConfig[] = [
  { level: 1,  gridSize: 3, direction: 'asc',                            lives: 3, comboTarget: 8 },
  { level: 2,  gridSize: 4, direction: 'asc',                            lives: 3, comboTarget: 10 },
  { level: 3,  gridSize: 4, direction: 'desc',                           lives: 3, comboTarget: 12 },
  { level: 4,  gridSize: 5, direction: 'asc',                            lives: 3, comboTarget: 15 },
  { level: 5,  gridSize: 5, direction: 'desc',       timeLimitPerNumber: 5, lives: 3, comboTarget: 18 },
  { level: 6,  gridSize: 3, direction: 'alternate',  timeLimitPerNumber: 6, lives: 3, comboTarget: 18 }, // 交替入门：小格 + 宽时限
  { level: 7,  gridSize: 4, direction: 'alternate',  timeLimitPerNumber: 5, lives: 3, comboTarget: 20 },
  { level: 8,  gridSize: 5, direction: 'alternate',  timeLimitPerNumber: 4, lives: 2, comboTarget: 22 }, // 交替进阶
  { level: 9,  gridSize: 6, direction: 'desc',       timeLimitPerNumber: 4, lives: 2, comboTarget: 28 },
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

// 确定性伪随机数（mulberry32）：见 src/lib/rng.ts

// mixed 方向的固定序列生成
// 注意：seed 必须与 SchulteGrid 的网格位置 seed（startTime）不同，否则
// 相同 seed + 相同输入 [1..N] 会洗出完全相同的序列，导致「点击顺序 == 网格位置」，
// 玩家看到的就是从左上角逐行点。这里用一个固定偏移让两者错开。
export function generateMixedSequence(gridSize: number, startTime: number): number[] {
  const N = gridSize * gridSize;
  const seed = (startTime + 0x9e3779b9) % 4294967296;
  const arr = Array.from({ length: N }, (_, i) => i + 1);
  return seededShuffle(arr, seed);
}

// 交替方向：正向（从小往大）/ 反向（从大往小）
export type StepDirection = '正' | '反';

// 交替序列：双指针 + 随机段长（1-4）。从两端往中间，每段连续点 1-4 个同方向数字后翻转。
// 同 seed 永远产出同序列，便于闯关重试复现。返回序列 + 每步对应方向（供 HUD 提示）。
export function buildAlternateWithDirections(N: number, seed: number): {
  sequence: number[];
  directions: StepDirection[];
} {
  const rng = mulberry32(seed);
  const sequence: number[] = [];
  const directions: StepDirection[] = [];
  let lo = 1;
  let hi = N;
  let dir: StepDirection = rng() < 0.5 ? '正' : '反'; // 初始方向随机
  let remaining = N;
  while (remaining > 0) {
    // 本段长度：1-4，且不超过剩余可点数
    const seg = Math.min(4, 1 + Math.floor(rng() * 4));
    const steps = Math.min(seg, remaining);
    for (let i = 0; i < steps; i++) {
      if (dir === '正') {
        sequence.push(lo++);
      } else {
        sequence.push(hi--);
      }
      directions.push(dir);
      remaining--;
    }
    dir = dir === '正' ? '反' : '正'; // 段结束翻转方向
  }
  return { sequence, directions };
}

// 根据关卡 level 获取配置
export function getLevelConfig(level: number): SchulteQuestLevelConfig | undefined {
  return SCHULTE_QUEST_LEVELS.find((l) => l.level === level);
}
