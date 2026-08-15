import { describe, it, expect } from 'vitest';
import { LOGIC_GAME_NAMES } from '@/types';
import { gameplayInstructionsMap } from '@/lib/gameplayInstructions';

const LOGIC_IDS = Object.keys(LOGIC_GAME_NAMES) as (keyof typeof LOGIC_GAME_NAMES)[];

describe('逻辑游戏注册完整性', () => {
  it('6 个游戏 id', () => {
    expect(LOGIC_IDS.sort()).toEqual(['fallacy', 'gates', 'lineup', 'syllogism', 'truth', 'zebra']);
  });
  it.each(LOGIC_IDS)('%s 有玩法说明', (id) => {
    const cfg = gameplayInstructionsMap[id];
    expect(cfg).toBeDefined();
    expect(cfg.howToPlay.length).toBeGreaterThan(0);
    expect(cfg.scoringRules.length).toBeGreaterThan(0);
  });
});
