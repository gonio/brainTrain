// 主线闯关模式（Quest Mode）的类型定义
// 详见 spec: docs/superpowers/specs/2026-06-24-quest-mode-design.md

/** 主线闯关支持的游戏标识 */
export type GameId = 'schulte' | 'sequence' | 'stroop' | 'bottle';

/** 各游戏支持的难度维度（仅标注非可选参数） */
export interface SchulteDifficultyParams {
  gridSize: 3 | 4 | 5 | 6;
  direction: 'asc' | 'desc' | 'alternate' | 'mixed';
  timeLimitPerNumber?: number;
  lives: 1 | 2 | 3;
}

export interface SequenceDifficultyParams {
  sequenceLength: number;
  displayMode: 'step' | 'flash';
  distractors: number;
  answerTimeLimit?: number;
}

export interface StroopDifficultyParams {
  questionCount: number;
  mode: 'standard' | 'reverse' | 'dual';
  timePerQuestion?: number;
}

export interface BottleDifficultyParams {
  bottleCount: number;
  timeLimit?: number;
}

/** 单级难度配置（含星级阈值） */
export interface DifficultyLevel<TParams> {
  difficulty: number;       // 1-10
  params: TParams;
  comboTarget?: number;     // 仅 Schulte 用
  goodThreshold: number;    // 2 星线
  excellentThreshold: number; // 3 星线
}

/** 统一的关卡完成结果（适配器产出） */
export interface QuestResult {
  gameId: GameId;
  difficulty: number;       // 1-10
  passed: true;             // 完成即推进，恒 true
  stars: 0 | 1 | 2 | 3;
  score: number;            // 原始分，仅展示
  details: Record<string, unknown>;
}

/** 主线进度（IndexedDB 单条记录） */
export interface QuestProgress {
  id: 'singleton';
  progress: Record<GameId, number>;   // 各游戏已通关的最高难度 0-10
  stars: Record<string, 0 | 1 | 2 | 3>; // key = `${gameId}-${difficulty}`
  completed: boolean;
}

/** 4 个游戏的 id 列表（引擎迭代用） */
export const GAME_IDS: readonly GameId[] = ['schulte', 'sequence', 'stroop', 'bottle'] as const;
