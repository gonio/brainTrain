import { describe, it, expect } from 'vitest';
import { ENGINES, getEngine } from '../../src/games/registry.js';
import type { GameMode } from '../../src/types/room.js';

describe('games registry', () => {
  it('ENGINES 包含 4 个游戏', () => {
    const modes: GameMode[] = ['schulte', 'stroop', 'sequence', 'bottle'];
    for (const m of modes) {
      expect(ENGINES[m]).toBeDefined();
      expect(ENGINES[m].mode).toBe(m);
    }
  });

  it('getEngine 返回对应引擎', () => {
    expect(getEngine('schulte').mode).toBe('schulte');
    expect(getEngine('stroop').mode).toBe('stroop');
    expect(getEngine('sequence').mode).toBe('sequence');
    expect(getEngine('bottle').mode).toBe('bottle');
  });

  it('所有引擎 generateSeed/createProgress 可调用', () => {
    const modes: GameMode[] = ['schulte', 'stroop', 'sequence', 'bottle'];
    for (const m of modes) {
      const e = ENGINES[m];
      const seed = e.generateSeed();
      expect(seed.mode).toBe(m);
      const p = e.createProgress();
      expect(p.mode).toBe(m);
    }
  });

  it('所有引擎 timeLimitMs > 0', () => {
    const modes: GameMode[] = ['schulte', 'stroop', 'sequence', 'bottle'];
    for (const m of modes) {
      expect(ENGINES[m].timeLimitMs).toBeGreaterThan(0);
    }
  });
});
