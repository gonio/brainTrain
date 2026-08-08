import { describe, it, expect } from 'vitest';
import { bottleEngine, BOTTLE_COLOR_IDS } from '../../src/games/bottleEngine.js';

describe('bottleEngine', () => {
  it('BOTTLE_COLOR_IDS 有 9 色，前 6 个用于对战', () => {
    expect(BOTTLE_COLOR_IDS).toHaveLength(9);
  });

  it('generateSeed 生成 target + initial，两者不全同，各 6 色', () => {
    const seed = bottleEngine.generateSeed();
    if (seed.mode !== 'bottle') throw new Error('mode 应为 bottle');
    expect(seed.targetSequence).toHaveLength(6);
    expect(seed.initialSequence).toHaveLength(6);
    expect(new Set(seed.targetSequence).size).toBe(6);  // 无重复
    expect(new Set(seed.initialSequence).size).toBe(6);
    // 不全同
    expect(seed.targetSequence).not.toEqual(seed.initialSequence);
  });

  it('createProgress 初始化为 initialSequence', () => {
    const seed = bottleEngine.generateSeed();
    if (seed.mode !== 'bottle') throw new Error();
    const p = bottleEngine.createProgress();
    if (p.mode !== 'bottle') throw new Error();
    expect(p.playerSequence).toEqual([]);
    expect(p.matched).toBe(0);
    expect(p.done).toBe(false);
  });

  it('applyAction 排到 target → done + finished', () => {
    const seed = bottleEngine.generateSeed();
    if (seed.mode !== 'bottle') throw new Error();
    const p = bottleEngine.createProgress();
    const r = bottleEngine.applyAction(p, { mode: 'bottle', playerSequence: seed.targetSequence }, seed, 0, 5000);
    if (r.progress.mode !== 'bottle') throw new Error();
    expect(r.progress.done).toBe(true);
    expect(r.progress.matched).toBe(6);
    expect(r.finished).toBe(true);
  });

  it('applyAction 部分匹配 → matched 计数正确，未完成', () => {
    const seed = bottleEngine.generateSeed();
    if (seed.mode !== 'bottle') throw new Error();
    const p = bottleEngine.createProgress();
    // 把第 0 位放对，其余乱放
    const seq = [...seed.targetSequence];
    [seq[1], seq[2]] = [seq[2], seq[1]];  // 交换 1、2 → 至少 4 个错位
    const r = bottleEngine.applyAction(p, { mode: 'bottle', playerSequence: seq }, seed, 0, 3000);
    if (r.progress.mode !== 'bottle') throw new Error();
    expect(r.progress.done).toBe(false);
    expect(r.progress.matched).toBeGreaterThan(0);
    expect(r.finished).toBe(false);
  });

  it('finalize 排对 → accuracy=1；未排对 → accuracy=matched/6', () => {
    const seed = bottleEngine.generateSeed();
    if (seed.mode !== 'bottle') throw new Error();
    // 排对
    const pDone = bottleEngine.applyAction(bottleEngine.createProgress(), { mode: 'bottle', playerSequence: seed.targetSequence }, seed, 0, 5000).progress;
    const fDone = bottleEngine.finalize(pDone, seed, 0, 5000);
    expect(fDone.accuracy).toBe(1);
    expect(fDone.done).toBe(true);
    // 部分匹配（只对 3 个）
    const partial = [...seed.targetSequence];
    [partial[3], partial[4]] = [partial[4], partial[3]];
    [partial[0], partial[1]] = [partial[1], partial[0]];
    const pPart = bottleEngine.applyAction(bottleEngine.createProgress(), { mode: 'bottle', playerSequence: partial }, seed, 0, 4000).progress;
    const fPart = bottleEngine.finalize(pPart, seed, 0, 60000);
    expect(fPart.done).toBe(false);
    if (pPart.mode !== 'bottle') throw new Error();
    expect(fPart.accuracy).toBeCloseTo(pPart.matched / 6, 5);
  });

  it('computePercent = matched / 6 * 100', () => {
    const seed = bottleEngine.generateSeed();
    if (seed.mode !== 'bottle') throw new Error();
    const partial = [...seed.targetSequence];
    [partial[0], partial[1]] = [partial[1], partial[0]];
    const p = bottleEngine.applyAction(bottleEngine.createProgress(), { mode: 'bottle', playerSequence: partial }, seed, 0, 3000).progress;
    const pct = bottleEngine.computePercent(p, seed);
    if (p.mode !== 'bottle') throw new Error();
    expect(pct).toBe(Math.round((p.matched / 6) * 100));
  });

  it('shouldEndWhenAnyDone = true（race）', () => {
    expect(bottleEngine.shouldEndWhenAnyDone).toBe(true);
  });
});
