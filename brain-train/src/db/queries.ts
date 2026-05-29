import { db } from './index';
import type { UserProfile, TrainingRecord, DailyGoal, TrainingMode, Statistics } from '../types';

const defaultUserProfile: UserProfile = {
  id: 'default',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  displayName: '用户',
  avatar: '👤', // 默认头像
  totalTrainingTime: 0,
  totalSessions: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastTrainingDate: '',
  preferences: {
    theme: 'auto',
    soundEnabled: true,
    ttsEnabled: true,
    dailyGoalSessions: 5
  }
};

// User Profile
export async function getUserProfile(): Promise<UserProfile> {
  const profile = await db.userProfile.get('default');
  return profile || defaultUserProfile;
}

export async function updateUserProfile(
  updates: Partial<UserProfile>
): Promise<void> {
  const existing = await getUserProfile();
  await db.userProfile.put({
    ...existing,
    ...updates,
    id: 'default',
    updatedAt: new Date().toISOString()
  });
}

// Training Records
export async function saveTrainingRecord(
  record: TrainingRecord
): Promise<void> {
  await db.trainingRecords.add(record);
}

export async function getTrainingRecords(
  options?: {
    mode?: TrainingMode;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }
): Promise<TrainingRecord[]> {
  let query = db.trainingRecords.toCollection();

  if (options?.mode) {
    query = db.trainingRecords.where('mode').equals(options.mode);
  }

  if (options?.startDate && options?.endDate) {
    query = db.trainingRecords
      .where('startedAt')
      .between(options.startDate, options.endDate);
  }

  return query.reverse().limit(options?.limit || 100).toArray();
}

export async function getTrainingRecordById(id: string): Promise<TrainingRecord | undefined> {
  return db.trainingRecords.get(id);
}

// 获取今日训练记录
export async function getTodayTrainingRecords(): Promise<TrainingRecord[]> {
  const today = new Date().toISOString().split('T')[0];
  return db.trainingRecords
    .where('startedAt')
    .startsWith(today)
    .toArray();
}

// Daily Goals
export async function getDailyGoal(date: string): Promise<DailyGoal | undefined> {
  return db.dailyGoals.get(date);
}

export async function updateDailyGoal(goal: DailyGoal): Promise<void> {
  await db.dailyGoals.put(goal);
}

// Statistics
export async function computeStatistics(): Promise<Statistics> {
  const records = await db.trainingRecords.toArray();

  const overall = {
    totalSessions: records.length,
    avgScore: records.length > 0
      ? records.reduce((sum, r) => sum + r.score, 0) / records.length
      : 0,
    avgAccuracy: records.length > 0
      ? records.reduce((sum, r) => sum + r.accuracy, 0) / records.length
      : 0
  };

  const modes: TrainingMode[] = ['schulte', 'stroop', 'sequence'];
  const byMode: Statistics['byMode'] = {} as Statistics['byMode'];

  for (const mode of modes) {
    const modeRecords = records.filter(r => r.mode === mode);
    byMode[mode] = {
      sessions: modeRecords.length,
      avgScore: modeRecords.length > 0
        ? modeRecords.reduce((sum, r) => sum + r.score, 0) / modeRecords.length
        : 0,
      avgAccuracy: modeRecords.length > 0
        ? modeRecords.reduce((sum, r) => sum + r.accuracy, 0) / modeRecords.length
        : 0,
      bestScore: modeRecords.length > 0
        ? Math.max(...modeRecords.map(r => r.score))
        : 0,
    };
  }

  // Compute 30-day trend
  const today = new Date();
  const trend: Statistics['trend'] = [];

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const dayRecords = records.filter(r => r.startedAt.startsWith(dateStr));

    trend.push({
      date: dateStr,
      sessions: dayRecords.length,
      avgScore: dayRecords.length > 0
        ? dayRecords.reduce((sum, r) => sum + r.score, 0) / dayRecords.length
        : 0
    });
  }

  return { overall, byMode, trend };
}
