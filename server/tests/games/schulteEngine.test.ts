import { describe, it, expect } from 'vitest';
import { schulteEngine } from '../../src/games/schulteEngine.js';

describe('schulteEngine', () => {
  it('generateSeed 生成 25 格表 + 合法 direction + order', () => {
    const seed = schulteEngine.generateSeed();
    if (seed.mode !== 'schulte') throw new Error('mode 应为 schulte');
    expect(seed.grid).toHaveLength(25);
    expect(seed.target).toBe(25);
    expect(seed.size).toBe(5);
    expect(['forward', 'reverse', 'random']).toContain(seed.direction);
    expect(seed.order).toHaveLength(25);
    // order 是 1..25 的某种排列
    const sorted = [...seed.order].sort((a, b) => a - b);
    expect(sorted).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });

  it('createProgress 初始化为 0', () => {
    const p = schulteEngine.createProgress();
    if (p.mode !== 'schulte') throw new Error('mode 不对');
    expect(p.found).toBe(0);
    expect(p.errors).toBe(0);
    expect(p.done).toBe(false);
  });

  it('applyAction 正序点对 → found+1', () => {
    const seed = schulteEngine.generateSeed();
    if (seed.mode !== 'schulte') throw new Error();
    const p = schulteEngine.createProgress();
    // order[0] 是第一个该点的数，找他在 grid 里的位置
    const firstTarget = seed.order[0];
    const cellIndex = seed.grid.indexOf(firstTarget);
    const { progress, finished } = schulteEngine.applyAction(p, { mode: 'schulte', cellIndex }, seed, 0, 1000);
    if (progress.mode !== 'schulte') throw new Error();
    expect(progress.found).toBe(1);
    expect(progress.errors).toBe(0);
    expect(finished).toBe(false);
  });

  it('applyAction 点错 → errors+1', () => {
    const seed = schulteEngine.generateSeed();
    if (seed.mode !== 'schulte') throw new Error();
    const p = schulteEngine.createProgress();
    // 故意点 order 的第二个（不是第一个）
    const wrongTarget = seed.order[1];
    const cellIndex = seed.grid.indexOf(wrongTarget);
    const { progress } = schulteEngine.applyAction(p, { mode: 'schulte', cellIndex }, seed, 0, 1000);
    if (progress.mode !== 'schulte') throw new Error();
    expect(progress.found).toBe(0);
    expect(progress.errors).toBe(1);
  });

  it('点完 25 个 → done + finished', () => {
    const seed = schulteEngine.generateSeed();
    if (seed.mode !== 'schulte') throw new Error();
    let p = schulteEngine.createProgress();
    let finished = false;
    for (let i = 0; i < 25; i++) {
      const target = seed.order[i];
      const cellIndex = seed.grid.indexOf(target);
      const r = schulteEngine.applyAction(p, { mode: 'schulte', cellIndex }, seed, 0, 1000 + i);
      p = r.progress;
      finished = r.finished;
    }
    if (p.mode !== 'schulte') throw new Error();
    expect(p.done).toBe(true);
    expect(p.found).toBe(25);
    expect(finished).toBe(true);
  });

  it('finalize 点完的用 finishTime，没点完补齐 errors', () => {
    const seed = schulteEngine.generateSeed();
    if (seed.mode !== 'schulte') throw new Error();
    // 点了 10 个
    let p = schulteEngine.createProgress();
    for (let i = 0; i < 10; i++) {
      const cellIndex = seed.grid.indexOf(seed.order[i]);
      p = schulteEngine.applyAction(p, { mode: 'schulte', cellIndex }, seed, 0, 1000 + i).progress;
    }
    const final = schulteEngine.finalize(p, seed, 0, 50000);
    expect(final.done).toBe(false);
    if (p.mode !== 'schulte') throw new Error();
    // detail.errors 应含补齐的 15
    expect(final.detail.errors).toBe(15);
    expect(final.timeMs).toBe(50000);
  });

  it('computePercent 单调递增', () => {
    const seed = schulteEngine.generateSeed();
    if (seed.mode !== 'schulte') throw new Error();
    let p = schulteEngine.createProgress();
    expect(schulteEngine.computePercent(p, seed)).toBe(0);
    for (let i = 0; i < 25; i++) {
      const cellIndex = seed.grid.indexOf(seed.order[i]);
      p = schulteEngine.applyAction(p, { mode: 'schulte', cellIndex }, seed, 0, 1000 + i).progress;
      const pct = schulteEngine.computePercent(p, seed);
      expect(pct).toBe(Math.round(((i + 1) / 25) * 100));
    }
  });

  it('shouldEndWhenAnyDone = true（race）', () => {
    expect(schulteEngine.shouldEndWhenAnyDone).toBe(true);
  });

  it('direction=forward 时 order 是 1..25', () => {
    // 多次生成直到拿到 forward，验证 order
    for (let attempt = 0; attempt < 50; attempt++) {
      const seed = schulteEngine.generateSeed();
      if (seed.mode === 'schulte' && seed.direction === 'forward') {
        expect(seed.order).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
        return;
      }
    }
    throw new Error('50 次都没生成 forward');
  });

  it('direction=reverse 时 order 是 25..1', () => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const seed = schulteEngine.generateSeed();
      if (seed.mode === 'schulte' && seed.direction === 'reverse') {
        expect(seed.order).toEqual(Array.from({ length: 25 }, (_, i) => 25 - i));
        return;
      }
    }
    throw new Error('50 次都没生成 reverse');
  });
});
