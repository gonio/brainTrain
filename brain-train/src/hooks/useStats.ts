import { useMemo } from 'react';
import type { TrainingRecord, TrainingMode, ModeStatistics, DailyStatistics, Statistics } from '../types';
import { calculateOverallStats, calculateModeStats, calculateTrend } from '../lib/stats';

export function useStats(records: TrainingRecord[]): Statistics {
  return useMemo(() => {
    return {
      overall: calculateOverallStats(records),
      byMode: calculateModeStats(records),
      trend: calculateTrend(records, 30)
    };
  }, [records]);
}

export function useModeStats(records: TrainingRecord[], mode: TrainingMode): ModeStatistics {
  return useMemo(() => {
    const modeRecords = records.filter(r => r.mode === mode);
    return {
      sessions: modeRecords.length,
      avgScore: modeRecords.length > 0
        ? modeRecords.reduce((sum, r) => sum + r.score, 0) / modeRecords.length
        : 0,
      avgAccuracy: modeRecords.length > 0
        ? modeRecords.reduce((sum, r) => sum + r.accuracy, 0) / modeRecords.length
        : 0,
      bestScore: modeRecords.length > 0
        ? Math.max(...modeRecords.map(r => r.score), 0)
        : 0,
      totalTime: modeRecords.reduce((sum, r) => sum + r.duration, 0) / 60
    };
  }, [records, mode]);
}

export function useTrend(records: TrainingRecord[], days: number = 30): DailyStatistics[] {
  return useMemo(() => calculateTrend(records, days), [records, days]);
}

export function useRecentRecords(records: TrainingRecord[], count: number = 10): TrainingRecord[] {
  return useMemo(() => {
    return [...records]
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, count);
  }, [records, count]);
}

export function useBestScores(records: TrainingRecord[]): Record<TrainingMode, number> {
  return useMemo(() => {
    const modes: TrainingMode[] = ['schulte', 'stroop', 'sequence', 'auditory', 'mirror', 'classify', 'story'];
    const result = {} as Record<TrainingMode, number>;

    for (const mode of modes) {
      const modeRecords = records.filter(r => r.mode === mode);
      result[mode] = modeRecords.length > 0
        ? Math.max(...modeRecords.map(r => r.score), 0)
        : 0;
    }

    return result;
  }, [records]);
}
