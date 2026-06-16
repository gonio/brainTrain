import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db';
import {
  getQuestProgress,
  saveQuestProgress,
  createInitialProgress,
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
