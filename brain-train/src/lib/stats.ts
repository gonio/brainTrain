import type { TrainingRecord, TrainingMode, ModeStatistics, DailyStatistics } from '../types';

export function calculateOverallStats(records: TrainingRecord[]) {
  return {
    totalSessions: records.length,
    totalTime: records.reduce((sum, r) => sum + r.duration, 0) / 60,
    avgScore: records.length > 0
      ? records.reduce((sum, r) => sum + r.score, 0) / records.length
      : 0,
    avgAccuracy: records.length > 0
      ? records.reduce((sum, r) => sum + r.accuracy, 0) / records.length
      : 0
  };
}

export function calculateModeStats(records: TrainingRecord[]): Record<TrainingMode, ModeStatistics> {
  const modes: TrainingMode[] = ['schulte', 'stroop', 'sequence', 'auditory', 'mirror', 'classify', 'story'];
  const result = {} as Record<TrainingMode, ModeStatistics>;

  for (const mode of modes) {
    const modeRecords = records.filter(r => r.mode === mode);
    result[mode] = {
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
  }

  return result;
}

export function calculateTrend(records: TrainingRecord[], days: number = 30): DailyStatistics[] {
  const today = new Date();
  const trend: DailyStatistics[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const dayRecords = records.filter(r => r.startedAt.startsWith(dateStr));

    trend.push({
      date: dateStr,
      sessions: dayRecords.length,
      totalTime: dayRecords.reduce((sum, r) => sum + r.duration, 0) / 60,
      avgScore: dayRecords.length > 0
        ? dayRecords.reduce((sum, r) => sum + r.score, 0) / dayRecords.length
        : 0
    });
  }

  return trend;
}

export function calculateStreak(records: TrainingRecord[]): { current: number; longest: number } {
  if (records.length === 0) return { current: 0, longest: 0 };

  const dates = [...new Set(records.map(r => r.startedAt.split('T')[0]))].sort();

  let currentStreak = 0;
  let longestStreak = 0;
  let currentCount = 0;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Check if trained today or yesterday to determine if streak is active
  const lastDate = dates[dates.length - 1];
  const isStreakActive = lastDate === today || lastDate === yesterday;

  for (let i = 0; i < dates.length; i++) {
    if (i === 0) {
      currentCount = 1;
    } else {
      const prevDate = new Date(dates[i - 1]);
      const currDate = new Date(dates[i]);
      const diffDays = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        currentCount++;
      } else {
        longestStreak = Math.max(longestStreak, currentCount);
        currentCount = 1;
      }
    }
  }

  longestStreak = Math.max(longestStreak, currentCount);

  // Calculate current streak
  if (isStreakActive) {
    currentStreak = 0;
    for (let i = dates.length - 1; i >= 0; i--) {
      const date = dates[i];
      const expectedDate = new Date(Date.now() - currentStreak * 86400000).toISOString().split('T')[0];

      if (date === expectedDate || (currentStreak === 0 && date === yesterday)) {
        currentStreak++;
      } else if (i < dates.length - 1) {
        break;
      }
    }
  } else {
    currentStreak = 0;
  }

  return { current: currentStreak, longest: longestStreak };
}
