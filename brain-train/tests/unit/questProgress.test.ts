import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db';
import {
  getQuestProgress,
  saveQuestProgress,
  createInitialProgress,
  getTrainingRecords,
} from '../../src/db/queries';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('SchulteQuestProgress 持久化', () => {
  it('无记录时返回初始进度', async () => {
    const p = await getQuestProgress();
    expect(p.clearedLevel).toBe(0);
    expect(p.totalStars).toBe(0);
    expect(p.inProgressLevel).toBeUndefined();
    expect(p.levelRecords).toEqual({});
  });

  it('saveQuestProgress 写入后可读取', async () => {
    await saveQuestProgress({
      id: 'singleton',
      clearedLevel: 3,
      totalStars: 6,
      inProgressLevel: 4,
      levelRecords: {
        1: { stars: 2, bestScore: 100, bestCombo: 10, bestTime: 15 },
        2: { stars: 1, bestScore: 100, bestCombo: 5, bestTime: 20 },
        3: { stars: 3, bestScore: 400, bestCombo: 15, bestTime: 25 },
      },
    });
    const p = await getQuestProgress();
    expect(p.clearedLevel).toBe(3);
    expect(p.totalStars).toBe(6);
    expect(p.inProgressLevel).toBe(4);
    expect(Object.keys(p.levelRecords)).toHaveLength(3);
  });

  it('多次 put 是更新而不是新增', async () => {
    await saveQuestProgress(createInitialProgress());
    await saveQuestProgress({
      id: 'singleton',
      clearedLevel: 1,
      totalStars: 2,
      levelRecords: { 1: { stars: 2, bestScore: 100, bestCombo: 10, bestTime: 15 } },
    });
    const all = await db.schulteQuestProgress.toArray();
    expect(all).toHaveLength(1);
  });
});

describe('读取旧 schulte 训练记录时自动兜底', () => {
  it('旧记录被 normalize 后有 mode 和 maxCombo', async () => {
    // 模拟旧数据：直接写入无 mode 字段的记录
    const legacyRecord: any = {
      id: 'legacy-1',
      mode: 'schulte',
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      duration: 30,
      score: 85,
      accuracy: 100,
      details: {
        gridSize: 5,
        order: 'asc',
        completionTime: 30,
        errorCount: 0,
        clickSequence: [],
        // 故意省略 mode 和 maxCombo
      },
    };
    await db.trainingRecords.put(legacyRecord);

    const records = await getTrainingRecords();
    const schulteRecords = records.filter(r => r.mode === 'schulte');
    expect(schulteRecords).toHaveLength(1);
    const details = schulteRecords[0].details as any;
    expect(details.mode).toBe('free');
    expect(details.maxCombo).toBe(0);
  });
});
