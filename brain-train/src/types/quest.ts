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

/** 舒尔特表结算明细（QuestResult.details，gameId==='schulte'） */
export interface SchulteQuestDetails {
  maxCombo: number;
  errorCount: number;
  /** 每次错点：点了哪个数字 / 当时应该点哪个 */
  errors: { clicked: number; expected: number }[];
}

/** 序列记忆结算明细（QuestResult.details，gameId==='sequence'） */
export interface SequenceQuestDetails {
  sequence: string[];       // 正确序列
  userSequence: string[];   // 用户选择序列
  positionAccuracy: number;
  itemAccuracy: number;     // 有干扰项时才有意义；无干扰项时恒为 100
  hasDistractors: boolean;
}

/** 字色干扰结算明细（QuestResult.details，gameId==='stroop'） */
export interface StroopQuestDetails {
  questionCount: number;
  correctCount: number;
  accuracy: number;
  /** 每道错题：题目词 / 题目显示色 / 用户答案 / 正确答案 / 本题规则。
   *  rule 标明该题要求「选颜色」还是「选字义」——dual 模式每题随机，
   *  不标规则用户无法理解对错。 */
  errors: {
    word: string;
    wordColor: string;
    userAnswer: string;
    correctAnswer: string;
    rule: 'standard' | 'reverse';
  }[];
}

/** 暗瓶结算明细（QuestResult.details，gameId==='bottle'） */
export interface BottleQuestDetails {
  totalSwaps: number;
  optimalSwaps: number;
}

/**
 * 统一的关卡完成结果（适配器产出）。
 *
 * details 按 gameId 分流到上述具名结构，但序列化字段仍保留为
 * Record<string, unknown> 以兼容存档/引擎（不强制 narrow）。
 * 结算页用 gameId 判别后再做局部断言。
 */
export interface QuestResult {
  gameId: GameId;
  difficulty: number;       // 1-10
  passed: boolean;          // true=过关（推进难度、记星）；false=失败（不推进、不记星，可重挑本关）
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
