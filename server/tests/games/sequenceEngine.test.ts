import { describe, it, expect } from 'vitest';
import { sequenceEngine, SEQUENCE_ITEM_POOL } from '../../src/games/sequenceEngine.js';

describe('sequenceEngine', () => {
  it('SEQUENCE_ITEM_POOL 有 12 个 emoji', () => {
    expect(SEQUENCE_ITEM_POOL).toHaveLength(12);
  });

  it('generateSeed 生成 6 元序列 + 干扰 + optionPool', () => {
    const seed = sequenceEngine.generateSeed();
    if (seed.mode !== 'sequence') throw new Error('mode 应为 sequence');
    expect(seed.sequence).toHaveLength(6);
    expect(seed.sequence.length).toBe(new Set(seed.sequence).size); // 无重复
    expect(seed.distractors.length).toBeGreaterThan(0);
    expect(seed.optionPool).toHaveLength(seed.sequence.length + seed.distractors.length);
    expect(seed.memorizeMs).toBe(4000);
    expect(seed.recallTimeLimitMs).toBe(15000);
  });

  it('createProgress 初始化', () => {
    const p = sequenceEngine.createProgress();
    if (p.mode !== 'sequence') throw new Error();
    expect(p.submitted).toBe(false);
    expect(p.userSequence).toEqual([]);
    expect(p.positionCorrect).toBe(0);
  });

  it('applyAction 提交全对 → positionCorrect=6, finished', () => {
    const seed = sequenceEngine.generateSeed();
    if (seed.mode !== 'sequence') throw new Error();
    const p = sequenceEngine.createProgress();
    const r = sequenceEngine.applyAction(p, { mode: 'sequence', userSequence: seed.sequence }, seed, 0, 5000);
    if (r.progress.mode !== 'sequence') throw new Error();
    expect(r.progress.submitted).toBe(true);
    expect(r.progress.positionCorrect).toBe(6);
    expect(r.finished).toBe(true);
  });

  it('applyAction 提交部分对 → positionCorrect 正确计数', () => {
    const seed = sequenceEngine.generateSeed();
    if (seed.mode !== 'sequence') throw new Error();
    const p = sequenceEngine.createProgress();
    // 只把第 0、2 位放对（共 2 对）
    const wrong = SEQUENCE_ITEM_POOL.find((e) => !seed.sequence.includes(e))!;
    const submitted = [seed.sequence[0], wrong, seed.sequence[2], wrong, wrong, wrong];
    const r = sequenceEngine.applyAction(p, { mode: 'sequence', userSequence: submitted }, seed, 0, 8000);
    if (r.progress.mode !== 'sequence') throw new Error();
    expect(r.progress.positionCorrect).toBe(2);
    expect(r.progress.submitted).toBe(true);
    expect(r.finished).toBe(true);
  });

  it('已提交再提交 → 不变', () => {
    const seed = sequenceEngine.generateSeed();
    if (seed.mode !== 'sequence') throw new Error();
    let p = sequenceEngine.createProgress();
    p = sequenceEngine.applyAction(p, { mode: 'sequence', userSequence: seed.sequence }, seed, 0, 5000).progress;
    const r = sequenceEngine.applyAction(p, { mode: 'sequence', userSequence: ['x', 'x', 'x', 'x', 'x', 'x'] }, seed, 0, 6000);
    // submitted 已 true，不变
    if (r.progress.mode !== 'sequence') throw new Error();
    expect(r.progress.positionCorrect).toBe(6);
  });

  it('finalize accuracy = positionCorrect / 6', () => {
    const seed = sequenceEngine.generateSeed();
    if (seed.mode !== 'sequence') throw new Error();
    const p = sequenceEngine.createProgress();
    const wrong = SEQUENCE_ITEM_POOL.find((e) => !seed.sequence.includes(e))!;
    const submitted = [seed.sequence[0], wrong, wrong, wrong, wrong, wrong]; // 1 对
    const prog = sequenceEngine.applyAction(p, { mode: 'sequence', userSequence: submitted }, seed, 0, 8000).progress;
    const final = sequenceEngine.finalize(prog, seed, 0, 15000);
    expect(final.accuracy).toBeCloseTo(1 / 6, 5);
    expect(final.done).toBe(true);
    expect(final.detail.positionCorrect).toBe(1);
  });

  it('finalize 未提交（超时）→ done=false, accuracy 按 0', () => {
    const seed = sequenceEngine.generateSeed();
    if (seed.mode !== 'sequence') throw new Error();
    const p = sequenceEngine.createProgress();
    const final = sequenceEngine.finalize(p, seed, 0, 15000);
    expect(final.done).toBe(false);
    expect(final.accuracy).toBe(0);
  });

  it('computePercent 提交后=100，未提交=0', () => {
    const seed = sequenceEngine.generateSeed();
    if (seed.mode !== 'sequence') throw new Error();
    const p0 = sequenceEngine.createProgress();
    expect(sequenceEngine.computePercent(p0, seed)).toBe(0);
    const p1 = sequenceEngine.applyAction(p0, { mode: 'sequence', userSequence: seed.sequence }, seed, 0, 5000).progress;
    expect(sequenceEngine.computePercent(p1, seed)).toBe(100);
  });

  it('shouldEndWhenAnyDone = false（双方都提交才结算）', () => {
    expect(sequenceEngine.shouldEndWhenAnyDone).toBe(false);
  });
});
