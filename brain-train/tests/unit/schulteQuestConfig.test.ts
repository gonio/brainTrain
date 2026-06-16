import { describe, it, expect } from 'vitest';
import {
  SCHULTE_QUEST_LEVELS,
  COMBO_MULTIPLIER_TABLE,
  computeComboMultiplier,
  computeStars,
  computeScore,
  generateMixedSequence,
} from '../../src/lib/schulteQuestConfig';

describe('SCHULTE_QUEST_LEVELS', () => {
  it('有 10 关', () => {
    expect(SCHULTE_QUEST_LEVELS).toHaveLength(10);
  });

  it('第 1 关是 3×3 正向 3 命无时限', () => {
    const lv1 = SCHULTE_QUEST_LEVELS[0];
    expect(lv1.level).toBe(1);
    expect(lv1.gridSize).toBe(3);
    expect(lv1.direction).toBe('asc');
    expect(lv1.lives).toBe(3);
    expect(lv1.timeLimitPerNumber).toBeUndefined();
    expect(lv1.comboTarget).toBe(8);
  });

  it('第 10 关是 6×6 mixed 1 命 3s/数字', () => {
    const lv10 = SCHULTE_QUEST_LEVELS[9];
    expect(lv10.level).toBe(10);
    expect(lv10.gridSize).toBe(6);
    expect(lv10.direction).toBe('mixed');
    expect(lv10.lives).toBe(1);
    expect(lv10.timeLimitPerNumber).toBe(3);
    expect(lv10.comboTarget).toBe(30);
  });
});

describe('COMBO_MULTIPLIER_TABLE', () => {
  it('是按 combo 升序排列的分段表', () => {
    expect(COMBO_MULTIPLIER_TABLE[0]).toEqual({ minCombo: 0, multiplier: 1.0 });
    expect(COMBO_MULTIPLIER_TABLE[1]).toEqual({ minCombo: 5, multiplier: 1.5 });
    expect(COMBO_MULTIPLIER_TABLE[2]).toEqual({ minCombo: 10, multiplier: 2.0 });
    expect(COMBO_MULTIPLIER_TABLE[3]).toEqual({ minCombo: 20, multiplier: 3.0 });
    expect(COMBO_MULTIPLIER_TABLE[4]).toEqual({ minCombo: 50, multiplier: 5.0 });
  });
});

describe('computeComboMultiplier', () => {
  it.each([
    [0, 1.0],
    [4, 1.0],
    [5, 1.5],
    [9, 1.5],
    [10, 2.0],
    [19, 2.0],
    [20, 3.0],
    [49, 3.0],
    [50, 5.0],
    [100, 5.0],
  ])('combo %i → 倍率 %f', (combo, expected) => {
    expect(computeComboMultiplier(combo)).toBe(expected);
  });
});

describe('computeStars', () => {
  it('未通关返回 0 星', () => {
    expect(computeStars({ passed: false, maxCombo: 100, errorCount: 0, comboTarget: 10 })).toBe(0);
  });

  it('通关保底 1 星', () => {
    expect(computeStars({ passed: true, maxCombo: 0, errorCount: 5, comboTarget: 10 })).toBe(1);
  });

  it('通关 + combo 达标 + 零错误 → 3 星', () => {
    expect(computeStars({ passed: true, maxCombo: 18, errorCount: 0, comboTarget: 15 })).toBe(3);
  });

  it('通关 + combo 达标 + 有错误 → 2 星', () => {
    expect(computeStars({ passed: true, maxCombo: 18, errorCount: 3, comboTarget: 15 })).toBe(2);
  });

  it('通关 + combo 不达标 + 零错误 → 2 星', () => {
    expect(computeStars({ passed: true, maxCombo: 5, errorCount: 0, comboTarget: 15 })).toBe(2);
  });
});

describe('computeScore', () => {
  it('第 5 关：基础 500 + 时间奖励 50 + combo 18 ×2.0 = 1100', () => {
    const score = computeScore({
      level: 5,
      timeLimitPerNumber: 5,
      gridSize: 5,
      maxCombo: 18,
      remainingTime: 10,
    });
    expect(score).toBe(1100);
  });

  it('无时限关卡：时间奖励为 0', () => {
    const score = computeScore({
      level: 1,
      timeLimitPerNumber: undefined,
      gridSize: 3,
      maxCombo: 8,
      remainingTime: 0,
    });
    // 基础 100 × 倍率 1.5 = 150
    expect(score).toBe(150);
  });

  it('combo 为 0 时倍率兜底 ×1.0', () => {
    const score = computeScore({
      level: 1,
      timeLimitPerNumber: undefined,
      gridSize: 3,
      maxCombo: 0,
      remainingTime: 0,
    });
    expect(score).toBe(100);
  });
});

describe('generateMixedSequence', () => {
  it('生成 1..N 的不重复序列', () => {
    const seq = generateMixedSequence(5, 12345);
    expect(seq).toHaveLength(25);
    const sorted = [...seq].sort((a, b) => a - b);
    expect(sorted).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });

  it('相同 startTime 生成相同序列', () => {
    const a = generateMixedSequence(4, 999);
    const b = generateMixedSequence(4, 999);
    expect(a).toEqual(b);
  });

  it('不同 startTime 生成不同序列（高概率）', () => {
    const a = generateMixedSequence(5, 1);
    const b = generateMixedSequence(5, 2);
    expect(a).not.toEqual(b);
  });

  it('3×3 网格生成 9 个数字', () => {
    const seq = generateMixedSequence(3, 0);
    expect(seq).toHaveLength(9);
  });
});
