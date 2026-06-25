import { describe, it, expect } from 'vitest';
import { pickNextGame, applyResult, isCleared, createInitialProgress } from '@/lib/questEngine';
import type { QuestProgress, QuestResult } from '@/types/quest';

const p = (s: number, q: number, t: number, b: number): QuestProgress['progress'] =>
  ({ schulte: s, sequence: q, stroop: t, bottle: b });

const result = (overides: Partial<QuestResult>): QuestResult => ({
  gameId: 'schulte',
  difficulty: 1,
  passed: true,
  stars: 1,
  score: 100,
  details: {},
  ...overides,
});

describe('pickNextGame', () => {
  it('全 0 时返回 4 个游戏之一', () => {
    const r = pickNextGame({ progress: p(0, 0, 0, 0) });
    expect(['schulte', 'sequence', 'stroop', 'bottle']).toContain(r);
  });

  it('舒尔特冒进到 5、其余 0 时，舒尔特被锁（nextDiff 6 - minNext 1 = 5，5<3 假）', () => {
    for (let i = 0; i < 50; i++) {
      expect(pickNextGame({ progress: p(5, 0, 0, 0) })).not.toBe('schulte');
    }
  });

  it('舒尔特 progress=2、其余 0 时仍可选（nextDiff 3 - 1 = 2，2<3 真）', () => {
    let possible = false;
    for (let i = 0; i < 100; i++) {
      if (pickNextGame({ progress: p(2, 0, 0, 0) }) === 'schulte') possible = true;
    }
    expect(possible).toBe(true);
  });

  it('某游戏推满 10 后不再被抽到', () => {
    for (let i = 0; i < 50; i++) {
      expect(pickNextGame({ progress: p(10, 0, 0, 0) })).not.toBe('schulte');
    }
  });

  it('全满时返回 null', () => {
    expect(pickNextGame({ progress: p(10, 10, 10, 10) })).toBeNull();
  });

  it('最坏连撞 ≤ 3：舒尔特 progress=3 时被锁（nextDiff 4 - 1 = 3，3<3 假）', () => {
    for (let i = 0; i < 50; i++) {
      expect(pickNextGame({ progress: p(3, 0, 0, 0) })).not.toBe('schulte');
    }
  });

  it('舒尔特 progress=2 时其他游戏也都可选（无副作用）', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(pickNextGame({ progress: p(2, 0, 0, 0) }));
    }
    expect(seen.size).toBe(4);
  });
});

describe('applyResult', () => {
  it('完成新难度时 progress[g] 更新为该难度', () => {
    const updated = applyResult(createInitialProgress(), result({ gameId: 'schulte', difficulty: 3, stars: 2 }));
    expect(updated.progress.schulte).toBe(3);
    expect(updated.stars['schulte-3']).toBe(2);
  });

  it('progress 只增不减（防回退）', () => {
    const initial: QuestProgress = { id: 'singleton', progress: p(5, 0, 0, 0), stars: {}, completed: false };
    const updated = applyResult(initial, result({ gameId: 'schulte', difficulty: 2, stars: 3 }));
    expect(updated.progress.schulte).toBe(5); // 不回退到 2
  });

  it('stars 只留最好（取 max）', () => {
    const initial: QuestProgress = {
      id: 'singleton', progress: p(3, 0, 0, 0), stars: { 'schulte-3': 2 }, completed: false,
    };
    const updated = applyResult(initial, result({ gameId: 'schulte', difficulty: 3, stars: 1 }));
    expect(updated.stars['schulte-3']).toBe(2); // 原 2 星，新 1 星，取 max=2
  });

  it('重玩低难度不回退已通关高难度的星级', () => {
    const initial: QuestProgress = {
      id: 'singleton', progress: p(5, 0, 0, 0), stars: { 'schulte-5': 3 }, completed: false,
    };
    const updated = applyResult(initial, result({ gameId: 'schulte', difficulty: 3, stars: 2 }));
    expect(updated.progress.schulte).toBe(5);
    expect(updated.stars['schulte-5']).toBe(3); // 未受影响
    expect(updated.stars['schulte-3']).toBe(2);
  });

  it('4 个全满时 completed=true', () => {
    const initial: QuestProgress = {
      id: 'singleton', progress: p(10, 10, 10, 9), stars: {}, completed: false,
    };
    const updated = applyResult(initial, result({ gameId: 'bottle', difficulty: 10, stars: 3 }));
    expect(updated.progress.bottle).toBe(10);
    expect(updated.completed).toBe(true);
  });

  it('不可变：不修改原对象', () => {
    const initial = createInitialProgress();
    const snapshot = JSON.parse(JSON.stringify(initial));
    applyResult(initial, result({ gameId: 'schulte', difficulty: 5, stars: 3 }));
    expect(initial).toEqual(snapshot);
  });
});

describe('isCleared', () => {
  it('4 个全为 10 时返回 true', () => {
    expect(isCleared({ progress: p(10, 10, 10, 10) })).toBe(true);
  });

  it('有未满时返回 false', () => {
    expect(isCleared({ progress: p(10, 10, 10, 9) })).toBe(false);
  });

  it('全 0 时返回 false', () => {
    expect(isCleared({ progress: p(0, 0, 0, 0) })).toBe(false);
  });
});
