// 舒尔特对战纯逻辑：生成表、处理 tap、计分、裁定。无副作用。
import type { PlayerProgress } from '../types/schulte.js';

// 生成 size*size 的舒尔特表（1~N 随机打乱）
export function generateGrid(size: number): number[] {
  const n = size * size;
  const grid = Array.from({ length: n }, (_, i) => i + 1);
  // Fisher-Yates 洗牌
  for (let i = grid.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [grid[i], grid[j]] = [grid[j], grid[i]];
  }
  return grid;
}

// applyTap 的返回：是否点对 + 更新后的进度（返回新对象，不可变）
export interface ApplyTapResult {
  correct: boolean;
  progress: PlayerProgress;
}

// 处理一次点击。grid 是权威表，progress 是当前进度，cellIndex 是点的格子。
// expected（当前该点的数）= found + 1。返回不可变的新进度。
export function applyTap(grid: number[], progress: PlayerProgress, cellIndex: number, _target: number): ApplyTapResult {
  if (progress.done) {
    return { correct: false, progress: { ...progress } };
  }
  if (cellIndex < 0 || cellIndex >= grid.length) {
    return { correct: false, progress: { ...progress, errors: progress.errors + 1 } };
  }
  const expected = progress.found + 1;
  const tapped = grid[cellIndex];
  if (tapped === expected) {
    const newFound = progress.found + 1;
    const done = newFound === grid.length;
    return {
      correct: true,
      progress: { ...progress, found: newFound, done, finishTime: done ? Date.now() : null },
    };
  }
  return { correct: false, progress: { ...progress, errors: progress.errors + 1 } };
}

// 计算正确率 = correct / (correct + errors)。correct=errors=0 返回 0（避免除零）。
export function computeAccuracy(correct: number, errors: number): number {
  const denom = correct + errors;
  if (denom === 0) return 0;
  return correct / denom;
}

// finalizeProgress 的返回（补齐后的结果 + 用时 + 正确率）
export interface FinalizedProgress {
  found: number;
  errors: number;
  done: boolean;
  timeMs: number;
  accuracy: number;
}

// 结算单玩家进度：没点完补齐 errors，算用时和正确率。
export function finalizeProgress(
  progress: PlayerProgress,
  target: number,
  timeLimitMs: number,
  startTime: number,
): FinalizedProgress {
  const unfilled = progress.done ? 0 : (target - progress.found);
  const finalErrors = progress.errors + unfilled;
  const timeMs = progress.done && progress.finishTime !== null
    ? progress.finishTime - startTime
    : timeLimitMs;
  return {
    found: progress.found,
    errors: finalErrors,
    done: progress.done,
    timeMs,
    accuracy: computeAccuracy(progress.found, finalErrors),
  };
}

// 裁定胜负。a 是「我」，b 是「对手」。
export function determineWinner(
  a: { accuracy: number; timeMs: number },
  b: { accuracy: number; timeMs: number },
): 'me' | 'opponent' | 'draw' {
  if (Math.abs(a.accuracy - b.accuracy) > 1e-9) {
    return a.accuracy > b.accuracy ? 'me' : 'opponent';
  }
  if (a.timeMs !== b.timeMs) {
    return a.timeMs < b.timeMs ? 'me' : 'opponent';
  }
  return 'draw';
}
