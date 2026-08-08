// 引擎注册表：按 GameMode 取引擎。
import type { GameMode } from '../types/room.js';
import type { GameEngine } from './types.js';
import { schulteEngine } from './schulteEngine.js';
import { stroopEngine } from './stroopEngine.js';
import { sequenceEngine } from './sequenceEngine.js';
import { bottleEngine } from './bottleEngine.js';

export const ENGINES: Record<GameMode, GameEngine> = {
  schulte: schulteEngine,
  stroop: stroopEngine,
  sequence: sequenceEngine,
  bottle: bottleEngine,
};

export function getEngine(mode: GameMode): GameEngine {
  return ENGINES[mode];
}
