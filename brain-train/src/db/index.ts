import Dexie, { type Table } from 'dexie';
import type { UserProfile, TrainingRecord, DailyGoal, SchulteQuestProgress } from '../types';
import type { QuestProgress } from '../types/quest';

export class BrainTrainDB extends Dexie {
  userProfile!: Table<UserProfile>;
  trainingRecords!: Table<TrainingRecord>;
  dailyGoals!: Table<DailyGoal>;
  schulteQuestProgress!: Table<SchulteQuestProgress>;
  questProgress!: Table<QuestProgress>;
  // 多人对战 token 表（singleton，id 固定 'current'）
  versusAuth!: Table<{ id: string; token: string; userId: string }>;

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

    // v3: 新增舒尔特闯关进度表（singleton 主键模式，使用 put 而非 add）
    this.version(3).stores({
      userProfile: 'id',
      trainingRecords: 'id, mode, startedAt, [mode+startedAt]',
      dailyGoals: 'date',
      schulteQuestProgress: 'id',
    });

    // v4: 新增主线闯关进度表（Quest Mode，singleton 主键，使用 put）
    this.version(4).stores({
      userProfile: 'id',
      trainingRecords: 'id, mode, startedAt, [mode+startedAt]',
      dailyGoals: 'date',
      schulteQuestProgress: 'id',
      questProgress: 'id',
    });

    // v5: 新增多人对战 token 表（singleton，id 固定 'current'）
    this.version(5).stores({
      userProfile: 'id',
      trainingRecords: 'id, mode, startedAt, [mode+startedAt]',
      dailyGoals: 'date',
      schulteQuestProgress: 'id',
      questProgress: 'id',
      versusAuth: 'id',
    });

    // v6: 主线闯关新增 6 个逻辑游戏，老存档 progress 补零键
    this.version(6).stores({
      userProfile: 'id',
      trainingRecords: 'id, mode, startedAt, [mode+startedAt]',
      dailyGoals: 'date',
      schulteQuestProgress: 'id',
      questProgress: 'id',
      versusAuth: 'id',
    }).upgrade(async (tx) => {
      const rec = await tx.table('questProgress').get('singleton');
      if (!rec) return;
      for (const g of ['gates', 'truth', 'lineup', 'syllogism', 'zebra', 'fallacy']) {
        if (rec.progress[g] === undefined) rec.progress[g] = 0;
      }
      await tx.table('questProgress').put(rec);
    });
  }
}

export const db = new BrainTrainDB();
