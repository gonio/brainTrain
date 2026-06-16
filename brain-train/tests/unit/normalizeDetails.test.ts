import { describe, it, expect } from 'vitest';
import { normalizeSchulteDetails } from '../../src/lib/normalizeDetails';
import type { SchulteDetails } from '../../src/types';

describe('normalizeSchulteDetails', () => {
  it('对带 mode 的数据原样返回', () => {
    const input: SchulteDetails = {
      mode: 'free',
      gridSize: 5,
      order: 'asc',
      completionTime: 30,
      errorCount: 0,
      clickSequence: [],
      maxCombo: 0,
    };
    expect(normalizeSchulteDetails(input)).toEqual(input);
  });

  it('对旧数据（无 mode）兜底为 free + maxCombo 0', () => {
    const legacy = {
      gridSize: 5,
      order: 'asc',
      completionTime: 30,
      errorCount: 2,
      clickSequence: [1, 2, 3],
    };
    const result = normalizeSchulteDetails(legacy);
    expect(result.mode).toBe('free');
    expect(result.maxCombo).toBe(0);
    expect(result.gridSize).toBe(5);
    expect(result.errorCount).toBe(2);
  });

  it('保留旧数据的所有原字段', () => {
    const legacy = {
      gridSize: 4,
      order: 'desc',
      completionTime: 45.5,
      errorCount: 1,
      clickSequence: [4, 3, 2, 1],
    };
    const result = normalizeSchulteDetails(legacy);
    expect(result.completionTime).toBe(45.5);
    expect(result.clickSequence).toEqual([4, 3, 2, 1]);
  });

  it('对已经是 quest 模式的数据保留所有字段', () => {
    const quest: SchulteDetails = {
      mode: 'quest',
      level: 5,
      gridSize: 5,
      order: 'desc',
      completionTime: 47,
      errorCount: 0,
      clickSequence: [],
      maxCombo: 18,
      livesUsed: 0,
      timeLimitPerNumber: 5,
      stars: 3,
    };
    expect(normalizeSchulteDetails(quest)).toEqual(quest);
  });
});
