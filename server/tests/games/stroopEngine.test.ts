import { describe, it, expect } from 'vitest';
import { stroopEngine, STROOP_COLORS } from '../../src/games/stroopEngine.js';

describe('stroopEngine', () => {
  it('STROOP_COLORS 有 6 个颜色', () => {
    expect(STROOP_COLORS).toHaveLength(6);
    expect(STROOP_COLORS.map((c) => c.name)).toEqual(['红色', '蓝色', '绿色', '黄色', '紫色', '橙色']);
  });

  it('generateSeed 生成 10 题，每题合法', () => {
    const seed = stroopEngine.generateSeed();
    if (seed.mode !== 'stroop') throw new Error('mode 应为 stroop');
    expect(seed.questions).toHaveLength(10);
    expect(seed.timePerQuestionSec).toBe(8);
    expect(seed.finishGraceSec).toBe(10);
    for (const q of seed.questions) {
      // word 和 wordColor 都是合法颜色名
      expect(STROOP_COLORS.some((c) => c.name === q.word)).toBe(true);
      expect(STROOP_COLORS.some((c) => c.name === q.wordColor)).toBe(true);
      // correctAnswer 符合 rule
      if (q.rule === 'standard') expect(q.correctAnswer).toBe(q.wordColor);
      else expect(q.correctAnswer).toBe(q.word);
    }
  });

  it('createProgress 初始化', () => {
    const p = stroopEngine.createProgress();
    if (p.mode !== 'stroop') throw new Error();
    expect(p.answered).toBe(0);
    expect(p.correct).toBe(0);
    expect(p.done).toBe(false);
  });

  it('applyAction 答对 → correct+1，答错 → errors+1', () => {
    const seed = stroopEngine.generateSeed();
    if (seed.mode !== 'stroop') throw new Error();
    const p = stroopEngine.createProgress();
    // 答对第一题
    const r1 = stroopEngine.applyAction(p, { mode: 'stroop', questionIndex: 0, answer: seed.questions[0].correctAnswer }, seed, 0, 1000);
    if (r1.progress.mode !== 'stroop') throw new Error();
    expect(r1.progress.answered).toBe(1);
    expect(r1.progress.correct).toBe(1);
    expect(r1.progress.errors).toBe(0);
    // 答错第二题（给个错误答案）
    const wrongAns = seed.questions[1].correctAnswer === '红色' ? '蓝色' : '红色';
    const r2 = stroopEngine.applyAction(r1.progress, { mode: 'stroop', questionIndex: 1, answer: wrongAns }, seed, 0, 2000);
    if (r2.progress.mode !== 'stroop') throw new Error();
    expect(r2.progress.answered).toBe(2);
    expect(r2.progress.correct).toBe(1);
    expect(r2.progress.errors).toBe(1);
  });

  it('答完 10 题 → done + finished', () => {
    const seed = stroopEngine.generateSeed();
    if (seed.mode !== 'stroop') throw new Error();
    let p = stroopEngine.createProgress();
    let finished = false;
    for (let i = 0; i < 10; i++) {
      const r = stroopEngine.applyAction(p, { mode: 'stroop', questionIndex: i, answer: seed.questions[i].correctAnswer }, seed, 0, 1000 + i * 100);
      p = r.progress;
      finished = r.finished;
    }
    if (p.mode !== 'stroop') throw new Error();
    expect(p.answered).toBe(10);
    expect(p.done).toBe(true);
    expect(finished).toBe(true);
  });

  it('finalize 正确率 = correct / 10', () => {
    const seed = stroopEngine.generateSeed();
    if (seed.mode !== 'stroop') throw new Error();
    let p = stroopEngine.createProgress();
    // 答对 7 题、错 3 题
    for (let i = 0; i < 10; i++) {
      const ans = i < 7 ? seed.questions[i].correctAnswer : '不存在';
      p = stroopEngine.applyAction(p, { mode: 'stroop', questionIndex: i, answer: ans }, seed, 0, 1000 + i * 100).progress;
    }
    const final = stroopEngine.finalize(p, seed, 0, 60000);
    expect(final.accuracy).toBe(0.7);
    expect(final.done).toBe(true);
    expect(final.detail.correct).toBe(7);
    expect(final.detail.errors).toBe(3);
  });

  it('computePercent = answered / 10 * 100', () => {
    const seed = stroopEngine.generateSeed();
    if (seed.mode !== 'stroop') throw new Error();
    let p = stroopEngine.createProgress();
    expect(stroopEngine.computePercent(p, seed)).toBe(0);
    for (let i = 0; i < 5; i++) {
      p = stroopEngine.applyAction(p, { mode: 'stroop', questionIndex: i, answer: seed.questions[i].correctAnswer }, seed, 0, 1000).progress;
    }
    expect(stroopEngine.computePercent(p, seed)).toBe(50);
  });

  it('shouldEndWhenAnyDone = false（用宽限机制）', () => {
    expect(stroopEngine.shouldEndWhenAnyDone).toBe(false);
  });
});
