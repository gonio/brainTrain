// 尝试次数制（尝试次数制 / Attempt-based Clearing，见 CONTEXT.md）：
// 谜题不限时，每题最多 3 次作答机会；按第几次答对评星。
export const MAX_ATTEMPTS = 3;

export interface LogicRoundOutcome {
  correct: boolean;
  attempts: number; // 实际作答次数（答对或机会用完时的次数）
}

export function starsForAttempts(used: number): 0 | 1 | 2 | 3 {
  if (used === 1) return 3;
  if (used === 2) return 2;
  if (used === 3) return 1;
  return 0;
}

/** 自由练习会话分：累计星数占满星比例 ×100 */
export function logicSessionScore(stars: number[]): number {
  if (stars.length === 0) return 0;
  const sum = stars.reduce((a, b) => a + b, 0);
  return Math.round((sum / (3 * stars.length)) * 100);
}

/** 首次作答正确率（%） */
export function firstTryAccuracy(rounds: LogicRoundOutcome[]): number {
  if (rounds.length === 0) return 0;
  const firstTry = rounds.filter((r) => r.correct && r.attempts === 1).length;
  return Math.round((firstTry / rounds.length) * 100);
}
