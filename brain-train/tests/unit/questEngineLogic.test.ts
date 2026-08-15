import { describe, it, expect } from 'vitest';
import { createInitialProgress, pickNextGame, isCleared } from '@/lib/questEngine';
import { GAME_IDS } from '@/types/quest';
import { DIFFICULTY_TABLES, getDifficulty } from '@/lib/questGameConfig';

describe('闯关集成 10 游戏', () => {
  it('GAME_IDS 10 个，初始进度全 0', () => {
    expect(GAME_IDS).toHaveLength(10);
    const p = createInitialProgress();
    expect(Object.keys(p.progress)).toHaveLength(10);
    expect(isCleared(p)).toBe(false);
    expect(pickNextGame(p)).not.toBeNull();
  });
  it('每个游戏都有 10 级难度表且 engineLevel 在界', () => {
    for (const g of GAME_IDS) {
      expect(DIFFICULTY_TABLES[g]).toHaveLength(10);
    }
    expect((getDifficulty('truth', 10).params as { engineLevel: number }).engineLevel).toBe(6);
    expect((getDifficulty('gates', 10).params as { engineLevel: number }).engineLevel).toBe(20);
    expect((getDifficulty('fallacy', 8).params as { engineLevel: number }).engineLevel).toBe(3);
  });
});
