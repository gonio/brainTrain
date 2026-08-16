import { describe, it, expect } from 'vitest';
import { calculateModeStats } from '@/lib/stats';
import type { TrainingRecord, TrainingMode } from '@/types';

const ALL_MODES: TrainingMode[] = [
  'schulte', 'stroop', 'sequence', 'bottle',
  'gates', 'truth', 'lineup', 'syllogism', 'zebra', 'fallacy',
];

const rec = (mode: TrainingMode, score: number): TrainingRecord => ({
  id: `${mode}-${score}-${Math.random()}`,
  mode,
  score,
  accuracy: 0.8,
  startedAt: '2026-08-16T10:00:00.000Z',
  durationMs: 60_000,
});

describe('calculateModeStats', () => {
  it('覆盖全部 10 个训练模式（含 6 个移植逻辑游戏与 bottle）', () => {
    const stats = calculateModeStats([]);
    for (const mode of ALL_MODES) {
      expect(stats[mode], `缺模式 ${mode}`).toBeDefined();
      expect(stats[mode].sessions).toBe(0);
    }
  });

  it('新模式的记录计入对应模式的统计', () => {
    const stats = calculateModeStats([rec('zebra', 90), rec('zebra', 70), rec('fallacy', 60)]);
    expect(stats.zebra.sessions).toBe(2);
    expect(stats.zebra.avgScore).toBe(80);
    expect(stats.zebra.bestScore).toBe(90);
    expect(stats.fallacy.sessions).toBe(1);
    expect(stats.schulte.sessions).toBe(0);
  });
});
