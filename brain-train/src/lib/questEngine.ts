// 主线闯关引擎：纯逻辑，不依赖 React
// 详见 spec: docs/superpowers/specs/2026-06-24-quest-mode-design.md §3, §5

import type { QuestProgress, QuestResult } from '@/types/quest';
import { GAME_IDS } from '@/types/quest';
import type { GameId } from '@/types/quest';

/** 初始进度：4 游戏全 0 */
export function createInitialProgress(): QuestProgress {
  return {
    id: 'singleton',
    progress: { schulte: 0, sequence: 0, stroop: 0, bottle: 0 },
    stars: {},
    completed: false,
  };
}

/**
 * 抽游戏算法：在候选游戏中均匀随机抽一个。
 *
 * 候选定义：
 *   1. progress[g] < 10（未推满）
 *   2. nextDifficulty(g) - minNext < 3，其中 nextDifficulty(g) = progress[g] + 1
 *      minNext = 所有候选游戏的 nextDifficulty 最小值
 *
 * 该约束保证最落后的游戏不会落后领先者超过 2，最坏连撞同一游戏 3 次。
 *
 * @returns 抽中的 GameId，或 null（已全满通关）
 */
export function pickNextGame(progress: Pick<QuestProgress, 'progress'>): GameId | null {
  const candidates: GameId[] = GAME_IDS.filter((g) => progress.progress[g] < 10);
  if (candidates.length === 0) return null;

  const nextDiffs = candidates.map((g) => progress.progress[g] + 1);
  const minNext = Math.min(...nextDiffs);
  const eligible = candidates.filter((_, i) => nextDiffs[i] - minNext < 3);

  const idx = Math.floor(Math.random() * eligible.length);
  return eligible[idx];
}

/**
 * 应用一关结果到进度（不可变，返回新对象）。
 *
 * 规则：
 *   - progress[g] = max(progress[g], difficulty)（防回退）
 *   - stars[key] = max(stars[key], newStars)（只留最好），key = `${gameId}-${difficulty}`
 *   - 4 个 progress 全 10 → completed = true
 */
export function applyResult(progress: QuestProgress, r: QuestResult): QuestProgress {
  const newGameProgress = Math.max(progress.progress[r.gameId], r.difficulty);
  const key = `${r.gameId}-${r.difficulty}`;
  const prevStars = progress.stars[key] ?? 0;
  const newStars = Math.max(prevStars, r.stars) as 0 | 1 | 2 | 3;

  const updatedProgress = { ...progress.progress, [r.gameId]: newGameProgress };
  return {
    ...progress,
    progress: updatedProgress,
    stars: { ...progress.stars, [key]: newStars },
    completed: isCleared({ progress: updatedProgress }),
  };
}

/** 4 个游戏是否全满（通关） */
export function isCleared(progress: Pick<QuestProgress, 'progress'>): boolean {
  return GAME_IDS.every((g) => progress.progress[g] >= 10);
}
