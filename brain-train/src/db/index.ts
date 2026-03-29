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
  }
}

export const db = new BrainTrainDB();
