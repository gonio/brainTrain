// 对战游戏引擎统一接口。每个游戏实现这套，roomHandlers 按 mode 分派。
import type { GameMode } from '../types/room.js';

// 字色题面定义（服务端生成；不含 userAnswer，那是客户端回填的）
export interface StroopQuestionDef {
  word: string;          // 显示的字（如「红」）
  wordColor: string;     // 字的颜色名（如「蓝」）
  correctAnswer: string;  // standard=wordColor，reverse=word
  rule: 'standard' | 'reverse';
}

// 服务端生成的题目/种子（下发给双方的「同题」），按 mode 区分。
export type GameSeed =
  | { mode: 'schulte'; grid: number[]; size: number; target: number; direction: 'forward' | 'reverse' | 'random'; order: number[] }
  | { mode: 'stroop'; questions: StroopQuestionDef[]; timePerQuestionSec: number; finishGraceSec: number }
  | { mode: 'sequence'; sequence: string[]; distractors: string[]; optionPool: string[]; memorizeMs: number; recallTimeLimitMs: number }
  | { mode: 'bottle'; targetSequence: string[]; initialSequence: string[] };

// 玩家权威进度（服务端内存态），按 mode 区分。
export type PlayerProgress =
  | { mode: 'schulte'; found: number; errors: number; done: boolean; finishTime: number | null }
  | { mode: 'stroop'; answered: number; correct: number; errors: number; done: boolean; finishTime: number | null }
  | { mode: 'sequence'; submitted: boolean; userSequence: string[]; positionCorrect: number; submitTime: number | null }
  | { mode: 'bottle'; playerSequence: string[]; matched: number; done: boolean; finishTime: number | null };

// 玩家上报的动作（C→S game:action.payload），按 mode 区分。
export type GameAction =
  | { mode: 'schulte'; cellIndex: number }
  | { mode: 'stroop'; questionIndex: number; answer: string }
  | { mode: 'sequence'; userSequence: string[] }
  | { mode: 'bottle'; playerSequence: string[] };

// 结算后的单玩家结果（统一结构，用于裁定 + 战绩 + 前端展示）
export interface FinalizedProgress {
  accuracy: number;       // 0–1
  timeMs: number;
  done: boolean;
  detail: Record<string, unknown>;  // 各游戏特有指标（found/errors、positionCorrect 等）
}

// 引擎统一接口
export interface GameEngine {
  mode: GameMode;
  timeLimitMs: number;
  generateSeed(): GameSeed;
  createProgress(): PlayerProgress;
  applyAction(progress: PlayerProgress, action: GameAction, seed: GameSeed, startTime: number, now: number): { progress: PlayerProgress; finished: boolean };
  finalize(progress: PlayerProgress, seed: GameSeed, startTime: number, endTime: number): FinalizedProgress;
  computePercent(progress: PlayerProgress, seed: GameSeed): number;  // 0–100
  shouldEndWhenAnyDone: boolean;  // true=race（舒尔特/暗瓶）
}
