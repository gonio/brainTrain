import { describe, it, expect } from 'vitest';
import { MAX_ATTEMPTS, starsForAttempts, logicSessionScore, firstTryAccuracy } from '@/lib/logic/attempts';

describe('尝试次数制计分', () => {
  it('星级映射', () => {
    expect(MAX_ATTEMPTS).toBe(3);
    expect(starsForAttempts(1)).toBe(3);
    expect(starsForAttempts(2)).toBe(2);
    expect(starsForAttempts(3)).toBe(1);
    expect(starsForAttempts(4)).toBe(0);
  });
  it('会话分：5 题全首对 = 100', () => {
    expect(logicSessionScore([3, 3, 3, 3, 3])).toBe(100);
    expect(logicSessionScore([3, 2, 1, 0, 3])).toBe(60);
    expect(logicSessionScore([])).toBe(0);
  });
  it('首次作答正确率', () => {
    expect(firstTryAccuracy([
      { attempts: 1, correct: true },
      { attempts: 2, correct: true },
      { attempts: 3, correct: false },
    ])).toBe(33);
    expect(firstTryAccuracy([])).toBe(0);
  });
});
