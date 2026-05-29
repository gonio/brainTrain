import Dexie, { type Table } from 'dexie';
import type { UserProfile, TrainingRecord, DailyGoal } from '../types';

export class BrainTrainDB extends Dexie {
  userProfile!: Table<UserProfile>;
  trainingRecords!: Table<TrainingRecord>;
  dailyGoals!: Table<DailyGoal>;

  constructor() {
    super('BrainTrainDB');
    this.version(1).stores({
      userProfile: 'id',
      trainingRecords: 'id, mode, startedAt, [mode+startedAt]',
      dailyGoals: 'date'
    });

    // v2: 清除所有训练记录和每日目标（评分制从千分制改为百分制）
    this.version(2).stores({
      userProfile: 'id',
      trainingRecords: 'id, mode, startedAt, [mode+startedAt]',
      dailyGoals: 'date'
    }).upgrade((tx) => {
      tx.table('trainingRecords').clear();
      tx.table('dailyGoals').clear();
    });
  }
}

export const db = new BrainTrainDB();
