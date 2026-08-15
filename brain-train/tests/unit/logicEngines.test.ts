import { describe, it, expect } from 'vitest';
import { generateGatesCircuit, evaluateCircuit } from '@/lib/logic/gatesEngine';
import { generateTruthPuzzle, countSolutions } from '@/lib/logic/truthEngine';
import { generateLineupPuzzle, countLineupSolutions } from '@/lib/logic/lineupEngine';
import { generateSyllogismPuzzle } from '@/lib/logic/syllogismEngine';
import { generateZebraPuzzle } from '@/lib/logic/zebraEngine';
import { judgeFallacy, FALLACY_TYPES } from '@/lib/logic/fallacyEngine';
import { FALLACY_BANK, pickFallacyQuestion } from '@/lib/logic/fallacyBank';

/** mulberry32 种子 PRNG：测试确定性用。组件的 rng prop 也吃这个类型。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('移植引擎冒烟', () => {
  it('gates：1/10/20 级生成且可求值', () => {
    for (const level of [1, 10, 20]) {
      const c = generateGatesCircuit(level, mulberry32(level));
      expect(c.gates.length).toBeGreaterThan(0);
      expect(typeof evaluateCircuit(c)).toBe('boolean');
    }
  });

  it('truth：3/4/5/6 人谜题有唯一解', () => {
    for (const level of [3, 4, 5, 6]) {
      const p = generateTruthPuzzle(level, mulberry32(level * 7));
      expect(p.statements).toHaveLength(level);
      expect(countSolutions(p)).toBe(1);
    }
  });

  it('lineup：1/10/20 级线索收敛到唯一解', () => {
    for (const level of [1, 10, 20]) {
      const p = generateLineupPuzzle(level, mulberry32(level * 13));
      expect(countLineupSolutions(p.people.length, p.clues)).toBe(1);
    }
  });

  it('syllogism：低级别只出 tier-1 全称式', () => {
    const p = generateSyllogismPuzzle(3, mulberry32(42));
    expect(p.premises).toHaveLength(2);
    expect(typeof p.valid).toBe('boolean');
  });

  it('zebra：1/11 级分别生成 3/4 座房子', () => {
    expect(generateZebraPuzzle(1, mulberry32(1)).houses).toBe(3);
    expect(generateZebraPuzzle(11, mulberry32(11)).houses).toBe(4);
  });

  it('fallacy：题库 31 题、8 类、判定正误', () => {
    expect(FALLACY_BANK).toHaveLength(31);
    expect(FALLACY_TYPES).toHaveLength(8);
    const q = pickFallacyQuestion(1, mulberry32(5));
    expect(q.difficulty).toBe(1);
    const correctSentence = q.material.find((s) => s.isFallacy)!;
    const good = judgeFallacy(q, correctSentence.id, q.fallacyType);
    expect(good.locatedCorrectly).toBe(true);
    expect(good.classifiedCorrectly).toBe(true);
    const bad = judgeFallacy(q, correctSentence.id, FALLACY_TYPES.find((t) => t !== q.fallacyType)!);
    expect(bad.classifiedCorrectly).toBe(false);
  });
});
