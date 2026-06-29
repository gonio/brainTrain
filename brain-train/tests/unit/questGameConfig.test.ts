import { describe, it, expect } from 'vitest';
import {
  SCHULTE_DIFFICULTIES,
  SEQUENCE_DIFFICULTIES,
  STROOP_DIFFICULTIES,
  BOTTLE_DIFFICULTIES,
  getDifficulty,
  DIFFICULTY_TABLES,
} from '@/lib/questGameConfig';
import { GAME_IDS } from '@/types/quest';

describe('questGameConfig 难度表完整性', () => {
  it('4 张表各 10 级', () => {
    GAME_IDS.forEach((g) => {
      expect(DIFFICULTY_TABLES[g]).toHaveLength(10);
    });
  });

  it('每级 difficulty 从 1 到 10 连续', () => {
    GAME_IDS.forEach((g) => {
      DIFFICULTY_TABLES[g].forEach((level, i) => {
        expect(level.difficulty).toBe(i + 1);
      });
    });
  });

  it('每级都有 goodThreshold 和 excellentThreshold', () => {
    GAME_IDS.forEach((g) => {
      DIFFICULTY_TABLES[g].forEach((level) => {
        expect(level.goodThreshold).toBeDefined();
        expect(level.excellentThreshold).toBeDefined();
      });
    });
  });

  it('Schulte/Sequence/Stroop 的 excellent >= good（分数维度，越大越好）', () => {
    (['schulte', 'sequence', 'stroop'] as const).forEach((g) => {
      DIFFICULTY_TABLES[g].forEach((level) => {
        expect(level.excellentThreshold).toBeGreaterThanOrEqual(level.goodThreshold);
      });
    });
  });

  it('Bottle 的 excellent <= good（步数倍率维度，越小越好）', () => {
    BOTTLE_DIFFICULTIES.forEach((level) => {
      expect(level.excellentThreshold).toBeLessThanOrEqual(level.goodThreshold);
    });
  });

  it('Sequence/Stroop 满星门槛=100（全对才 3 星，错一个不能满星）', () => {
    // 这些是「对/错题」语义的游戏，满星要求零失误。
    (['sequence', 'stroop'] as const).forEach((g) => {
      DIFFICULTY_TABLES[g].forEach((level) => {
        expect(level.excellentThreshold).toBe(100);
      });
    });
  });

  it('getDifficulty 返回正确难度', () => {
    expect(getDifficulty('schulte', 1).difficulty).toBe(1);
    expect(getDifficulty('schulte', 10).difficulty).toBe(10);
    expect(getDifficulty('bottle', 5).difficulty).toBe(5);
  });

  it('Sequence 难度序列长度单调递增或持平（不回退）', () => {
    const lengths = SEQUENCE_DIFFICULTIES.map((l) => l.params.sequenceLength);
    for (let i = 1; i < lengths.length; i++) {
      expect(lengths[i]).toBeGreaterThanOrEqual(lengths[i - 1]);
    }
  });

  it('Stroop 题数单调递增或持平', () => {
    const counts = STROOP_DIFFICULTIES.map((l) => l.params.questionCount);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    }
  });

  it('Bottle 瓶子数单调递增或持平', () => {
    const counts = BOTTLE_DIFFICULTIES.map((l) => l.params.bottleCount);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    }
  });

  it('Schulte gridSize 单调递增或持平', () => {
    const sizes = SCHULTE_DIFFICULTIES.map((l) => l.params.gridSize);
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1]);
    }
  });
});
