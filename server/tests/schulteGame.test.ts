import { describe, it, expect } from 'vitest';
import {
  generateGrid,
  applyTap,
  computeAccuracy,
  finalizeProgress,
  determineWinner,
} from '../src/schulte/schulteGame.js';
import type { PlayerProgress } from '../src/types/schulte.js';

describe('schulteGame', () => {
  describe('generateGrid', () => {
    it('生成 size*size 个 1~N 的数字', () => {
      const grid = generateGrid(5);
      expect(grid).toHaveLength(25);
      const sorted = [...grid].sort((a, b) => a - b);
      expect(sorted).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    });

    it('每次生成顺序不同（随机打乱）', () => {
      const grids = new Set(Array.from({ length: 10 }, () => generateGrid(5).join(',')));
      expect(grids.size).toBeGreaterThan(1);
    });

    it('size=3 生成 9 个数', () => {
      const grid = generateGrid(3);
      expect(grid).toHaveLength(9);
    });
  });

  describe('applyTap', () => {
    const makeProgress = (found = 0, errors = 0): PlayerProgress => ({
      playerId: 'p1', found, errors, done: false, finishTime: null,
    });

    it('点对下一个数：found++', () => {
      const grid = [1, 2, 3, 4, 5];
      const prog = makeProgress(0);
      const result = applyTap(grid, prog, 0, 5);
      expect(result.correct).toBe(true);
      expect(result.progress.found).toBe(1);
      expect(result.progress.errors).toBe(0);
    });

    it('点错（不是当前该点的数）：errors++', () => {
      const grid = [1, 2, 3, 4, 5];
      const prog = makeProgress(0);
      const result = applyTap(grid, prog, 1, 5);
      expect(result.correct).toBe(false);
      expect(result.progress.found).toBe(0);
      expect(result.progress.errors).toBe(1);
    });

    it('点到最后一个：done=true，记录 finishTime', () => {
      const grid = [1, 2, 3];
      const prog = makeProgress(2);
      const result = applyTap(grid, prog, 2, 3);
      expect(result.correct).toBe(true);
      expect(result.progress.found).toBe(3);
      expect(result.progress.done).toBe(true);
      expect(result.progress.finishTime).not.toBeNull();
    });

    it('已点完后再 tap：无变化（幂等）', () => {
      const grid = [1, 2, 3];
      const prog: PlayerProgress = { playerId: 'p1', found: 3, errors: 0, done: true, finishTime: 1000 };
      const result = applyTap(grid, prog, 0, 3);
      expect(result.progress.found).toBe(3);
      expect(result.progress.done).toBe(true);
    });

    it('cellIndex 越界：errors++（防御）', () => {
      const grid = [1, 2, 3];
      const prog = makeProgress(0);
      const result = applyTap(grid, prog, 99, 3);
      expect(result.correct).toBe(false);
      expect(result.progress.errors).toBe(1);
    });
  });

  describe('computeAccuracy', () => {
    it('correct=25 errors=0 → 1', () => {
      expect(computeAccuracy(25, 0)).toBe(1);
    });

    it('correct=25 errors=3 → 25/28', () => {
      expect(computeAccuracy(25, 3)).toBeCloseTo(25 / 28, 5);
    });

    it('correct=0 errors=0 → 0（避免除零，返回 0）', () => {
      expect(computeAccuracy(0, 0)).toBe(0);
    });

    it('correct=20 errors=7 → 20/27', () => {
      expect(computeAccuracy(20, 7)).toBeCloseTo(20 / 27, 5);
    });
  });

  describe('finalizeProgress', () => {
    it('没点完：errors 补齐 (target - found)', () => {
      const prog: PlayerProgress = { playerId: 'p1', found: 20, errors: 2, done: false, finishTime: null };
      const finalized = finalizeProgress(prog, 25, 90000, 1000);
      expect(finalized.errors).toBe(2 + 5);
      expect(finalized.found).toBe(20);
      expect(finalized.done).toBe(false);
    });

    it('点完：errors 不补齐', () => {
      const prog: PlayerProgress = { playerId: 'p1', found: 25, errors: 3, done: true, finishTime: 50000 };
      const finalized = finalizeProgress(prog, 25, 90000, 0);
      expect(finalized.errors).toBe(3);
      expect(finalized.done).toBe(true);
    });

    it('计算用时：点完用 finishTime-startTime，没点完用 timeLimitMs', () => {
      const done: PlayerProgress = { playerId: 'p1', found: 25, errors: 0, done: true, finishTime: 45000 };
      expect(finalizeProgress(done, 25, 90000, 0).timeMs).toBe(45000);
      const notDone: PlayerProgress = { playerId: 'p2', found: 20, errors: 2, done: false, finishTime: null };
      expect(finalizeProgress(notDone, 25, 90000, 0).timeMs).toBe(90000);
    });

    it('计算 accuracy（基于补齐后的 errors）', () => {
      const prog: PlayerProgress = { playerId: 'p1', found: 20, errors: 2, done: false, finishTime: null };
      const finalized = finalizeProgress(prog, 25, 90000, 0);
      expect(finalized.accuracy).toBeCloseTo(20 / 27, 5);
    });
  });

  describe('determineWinner', () => {
    const makeResult = (acc: number, time: number) => ({
      playerId: 'p', found: 0, errors: 0, accuracy: acc, timeMs: time, done: false, won: false,
    });

    it('正确率高者胜', () => {
      expect(determineWinner(makeResult(0.9, 30000), makeResult(0.8, 20000))).toBe('me');
    });

    it('正确率相同，用时短者胜', () => {
      expect(determineWinner(makeResult(0.9, 30000), makeResult(0.9, 20000))).toBe('opponent');
    });

    it('正确率和用时都相同 → 平局', () => {
      expect(determineWinner(makeResult(0.9, 30000), makeResult(0.9, 30000))).toBe('draw');
    });

    it('从「我」视角：我正确率高 → me', () => {
      expect(determineWinner(makeResult(0.95, 10000), makeResult(0.5, 50000))).toBe('me');
    });
  });
});
