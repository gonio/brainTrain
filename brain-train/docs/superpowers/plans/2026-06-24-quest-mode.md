# 主线闯关模式实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有自由训练之外新增「主线闯关」入口，用 `pickNextGame` 算法随机串联 4 个小游戏（由易到难），带星级收集，共 40 关。

**Architecture:** 纯逻辑层（引擎+难度表）→ 类型+数据层（IndexedDB v4）→ 适配器层（4 个 Runner 包裹原组件）→ UI 层（Quest 页面状态机）→ 集成（首页双入口）。原游戏组件纯增量增强，自由模式零回归。

**Tech Stack:** React 19, TypeScript, Zustand, Dexie (IndexedDB), framer-motion, Tailwind v4, Vitest + jsdom

**Spec:** `docs/superpowers/specs/2026-06-24-quest-mode-design.md`

---

## 文件结构总览

### 新增文件
| 文件 | 职责 |
|---|---|
| `src/types/quest.ts` | GameId / QuestProgress / QuestResult / 难度表类型 |
| `src/lib/questGameConfig.ts` | 4 游戏 ×10 级难度参数表 + 星级阈值 |
| `src/lib/questEngine.ts` | pickNextGame / applyResult / isCleared 纯逻辑 |
| `src/components/quest/QuestRunner.tsx` | 按 gameId 分发到对应 Runner |
| `src/components/quest/QuestSchulteRunner.tsx` | Schulte 适配器 |
| `src/components/quest/QuestSequenceRunner.tsx` | Sequence 适配器 |
| `src/components/quest/QuestStroopRunner.tsx` | Stroop 适配器（自带流程管理）|
| `src/components/quest/QuestBottleRunner.tsx` | Bottle 适配器 |
| `src/components/quest/QuestHub.tsx` | 关卡大厅 |
| `src/components/quest/QuestHUD.tsx` | 进行中顶部条 |
| `src/components/quest/QuestResultDialog.tsx` | 结算弹窗 |
| `src/pages/Quest.tsx` | 主线页面（Hub ↔ Session ↔ Result 状态机）|

### 改动文件
| 文件 | 改动 |
|---|---|
| `src/db/index.ts` | bump v4：新增 questProgress 表 |
| `src/db/queries.ts` | 新增 getQuestProgress/saveQuestProgress（独立 key）|
| `src/App.tsx` | 首页双大卡 + 路由 `/quest` |
| `src/components/game/SequenceGame.tsx` | 加 distractors/displayMode/answerTimeLimit prop |
| `src/components/game/StroopGame.tsx` | 加 mode/timePerQuestion prop |
| `src/components/game/BottleGame.tsx` | 加 timeLimit prop + 删下排 JSX |
| `src/components/quest/index.ts` | barrel export |

### 测试文件（放 `tests/unit/`，遵循现有约定）
| 文件 | 覆盖 |
|---|---|
| `tests/unit/questEngine.test.ts` | pickNextGame/applyResult/isCleared 全边界 |
| `tests/unit/questGameConfig.test.ts` | 4 张难度表完整性、参数单调、阈值存在 |

---

## 任务依赖图

```
Task 1 (类型) ─┬─→ Task 2 (难度表) ─→ Task 3 (引擎) [TDD]
               └─→ Task 4 (DB v4 + queries)
                                          │
Task 5 (SequenceGame 增强) ──────────────┐│
Task 6 (StroopGame 增强) ───────────────┐││
Task 7 (BottleGame 增强 + 删下排) ──────┐│││
                                        ││││
Task 8 (4 Runners + 分发器) ←───────────┴┴┴┘
Task 9 (Quest UI: Hub/HUD/ResultDialog)
Task 10 (Quest.tsx 状态机 + 路由 + 首页双入口)
Task 11 (集成验证 + 自由模式回归)
```

Task 1-3 是纯逻辑可独立 TDD；Task 5-7 各自独立可并行；Task 8 依赖 5-7；Task 9-10 串行。

---

## Task 1: 定义主线闯关类型

**Files:**
- Create: `src/types/quest.ts`

- [ ] **Step 1: 创建类型文件**

```ts
// src/types/quest.ts

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
```

- [ ] **Step 2: 验证编译**

Run: `cd brain-train && npx tsc -b`
Expected: 0 errors（新文件无引用，不影响现有代码）

- [ ] **Step 3: Commit**

```bash
git add src/types/quest.ts
git commit -m "feat(quest): 定义主线闯关类型（GameId/QuestProgress/QuestResult）"
```

---

## Task 2: 编写 4 游戏难度参数表

**Files:**
- Create: `src/lib/questGameConfig.ts`

依赖 Task 1 的类型。

- [ ] **Step 1: 创建难度表文件**

```ts
// src/lib/questGameConfig.ts
import type {
  DifficultyLevel,
  SchulteDifficultyParams,
  SequenceDifficultyParams,
  StroopDifficultyParams,
  BottleDifficultyParams,
  GameId,
} from '@/types/quest';

// ── Schulte 舒尔特（10 级，复用现有闯关体系） ──
export const SCHULTE_DIFFICULTIES: readonly DifficultyLevel<SchulteDifficultyParams>[] = [
  { difficulty: 1,  params: { gridSize: 3, direction: 'asc',                              lives: 3 }, comboTarget: 8,  goodThreshold: 8,  excellentThreshold: 12 },
  { difficulty: 2,  params: { gridSize: 4, direction: 'asc',                              lives: 3 }, comboTarget: 10, goodThreshold: 10, excellentThreshold: 15 },
  { difficulty: 3,  params: { gridSize: 4, direction: 'desc',                             lives: 3 }, comboTarget: 12, goodThreshold: 12, excellentThreshold: 18 },
  { difficulty: 4,  params: { gridSize: 5, direction: 'asc',                              lives: 3 }, comboTarget: 15, goodThreshold: 15, excellentThreshold: 22 },
  { difficulty: 5,  params: { gridSize: 5, direction: 'desc',     timeLimitPerNumber: 5, lives: 3 }, comboTarget: 18, goodThreshold: 18, excellentThreshold: 25 },
  { difficulty: 6,  params: { gridSize: 5, direction: 'alternate', timeLimitPerNumber: 6, lives: 3 }, comboTarget: 18, goodThreshold: 18, excellentThreshold: 25 },
  { difficulty: 7,  params: { gridSize: 5, direction: 'alternate', timeLimitPerNumber: 5, lives: 2 }, comboTarget: 20, goodThreshold: 20, excellentThreshold: 28 },
  { difficulty: 8,  params: { gridSize: 6, direction: 'desc',     timeLimitPerNumber: 4, lives: 2 }, comboTarget: 25, goodThreshold: 25, excellentThreshold: 35 },
  { difficulty: 9,  params: { gridSize: 6, direction: 'mixed',    timeLimitPerNumber: 3, lives: 2 }, comboTarget: 28, goodThreshold: 28, excellentThreshold: 40 },
  { difficulty: 10, params: { gridSize: 6, direction: 'mixed',    timeLimitPerNumber: 3, lives: 1 }, comboTarget: 30, goodThreshold: 30, excellentThreshold: 45 },
];

// ── Sequence 序列记忆（10 级） ──
export const SEQUENCE_DIFFICULTIES: readonly DifficultyLevel<SequenceDifficultyParams>[] = [
  { difficulty: 1,  params: { sequenceLength: 4,  displayMode: 'step',  distractors: 0 }, goodThreshold: 80, excellentThreshold: 95 },
  { difficulty: 2,  params: { sequenceLength: 5,  displayMode: 'step',  distractors: 0 }, goodThreshold: 80, excellentThreshold: 95 },
  { difficulty: 3,  params: { sequenceLength: 6,  displayMode: 'step',  distractors: 0 }, goodThreshold: 80, excellentThreshold: 95 },
  { difficulty: 4,  params: { sequenceLength: 6,  displayMode: 'flash', distractors: 0 }, goodThreshold: 80, excellentThreshold: 95 },
  { difficulty: 5,  params: { sequenceLength: 7,  displayMode: 'flash', distractors: 0 }, goodThreshold: 80, excellentThreshold: 95 },
  { difficulty: 6,  params: { sequenceLength: 7,  displayMode: 'flash', distractors: 1 }, goodThreshold: 75, excellentThreshold: 90 },
  { difficulty: 7,  params: { sequenceLength: 8,  displayMode: 'flash', distractors: 2 }, goodThreshold: 75, excellentThreshold: 90 },
  { difficulty: 8,  params: { sequenceLength: 9,  displayMode: 'flash', distractors: 2 }, goodThreshold: 70, excellentThreshold: 85 },
  { difficulty: 9,  params: { sequenceLength: 10, displayMode: 'flash', distractors: 3 }, goodThreshold: 70, excellentThreshold: 85 },
  { difficulty: 10, params: { sequenceLength: 10, displayMode: 'flash', distractors: 3, answerTimeLimit: 20 }, goodThreshold: 65, excellentThreshold: 80 },
];

// ── Stroop 斯特鲁普（10 级） ──
export const STROOP_DIFFICULTIES: readonly DifficultyLevel<StroopDifficultyParams>[] = [
  { difficulty: 1,  params: { questionCount: 10, mode: 'standard' },                          goodThreshold: 80, excellentThreshold: 95 },
  { difficulty: 2,  params: { questionCount: 12, mode: 'standard' },                          goodThreshold: 80, excellentThreshold: 95 },
  { difficulty: 3,  params: { questionCount: 15, mode: 'standard' },                          goodThreshold: 80, excellentThreshold: 95 },
  { difficulty: 4,  params: { questionCount: 15, mode: 'reverse' },                           goodThreshold: 75, excellentThreshold: 90 },
  { difficulty: 5,  params: { questionCount: 15, mode: 'dual' },                              goodThreshold: 70, excellentThreshold: 85 },
  { difficulty: 6,  params: { questionCount: 18, mode: 'dual' },                              goodThreshold: 70, excellentThreshold: 85 },
  { difficulty: 7,  params: { questionCount: 20, mode: 'dual' },                              goodThreshold: 70, excellentThreshold: 85 },
  { difficulty: 8,  params: { questionCount: 20, mode: 'dual', timePerQuestion: 3 },          goodThreshold: 65, excellentThreshold: 80 },
  { difficulty: 9,  params: { questionCount: 20, mode: 'dual', timePerQuestion: 2 },          goodThreshold: 60, excellentThreshold: 75 },
  { difficulty: 10, params: { questionCount: 20, mode: 'dual', timePerQuestion: 2 },          goodThreshold: 55, excellentThreshold: 70 },
];

// ── Bottle 暗瓶排列（10 级） ──
// 星级阈值用「步数倍率」语义：goodThreshold=1.5 表示 swaps ≤ optimal×1.5 得 2 星；excellentThreshold=1.0 表示 swaps ≤ optimal 得 3 星。
export const BOTTLE_DIFFICULTIES: readonly DifficultyLevel<BottleDifficultyParams>[] = [
  { difficulty: 1,  params: { bottleCount: 4 },                 goodThreshold: 1.5, excellentThreshold: 1.0 },
  { difficulty: 2,  params: { bottleCount: 5 },                 goodThreshold: 1.5, excellentThreshold: 1.0 },
  { difficulty: 3,  params: { bottleCount: 6 },                 goodThreshold: 1.5, excellentThreshold: 1.0 },
  { difficulty: 4,  params: { bottleCount: 6, timeLimit: 90 },  goodThreshold: 1.5, excellentThreshold: 1.0 },
  { difficulty: 5,  params: { bottleCount: 7, timeLimit: 90 },  goodThreshold: 1.5, excellentThreshold: 1.0 },
  { difficulty: 6,  params: { bottleCount: 7, timeLimit: 60 },  goodThreshold: 1.5, excellentThreshold: 1.0 },
  { difficulty: 7,  params: { bottleCount: 8, timeLimit: 60 },  goodThreshold: 1.5, excellentThreshold: 1.0 },
  { difficulty: 8,  params: { bottleCount: 8, timeLimit: 45 },  goodThreshold: 1.5, excellentThreshold: 1.0 },
  { difficulty: 9,  params: { bottleCount: 9, timeLimit: 45 },  goodThreshold: 1.5, excellentThreshold: 1.0 },
  { difficulty: 10, params: { bottleCount: 9, timeLimit: 30 },  goodThreshold: 1.5, excellentThreshold: 1.0 },
];

/** 按 gameId 取难度表 */
export const DIFFICULTY_TABLES: Record<GameId, readonly DifficultyLevel<unknown>[]> = {
  schulte: SCHULTE_DIFFICULTIES,
  sequence: SEQUENCE_DIFFICULTIES,
  stroop: STROOP_DIFFICULTIES,
  bottle: BOTTLE_DIFFICULTIES,
};

/** 取某游戏某难度配置 */
export function getDifficulty(gameId: GameId, difficulty: number): DifficultyLevel<unknown> {
  const table = DIFFICULTY_TABLES[gameId];
  return table[difficulty - 1];
}
```

- [ ] **Step 2: 验证编译**

Run: `cd brain-train && npx tsc -b`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/questGameConfig.ts
git commit -m "feat(quest): 编写 4 游戏各 10 级难度参数表与星级阈值"
```

---

## Task 3: 实现抽游戏引擎（TDD）

**Files:**
- Test: `tests/unit/questEngine.test.ts`
- Create: `src/lib/questEngine.ts`

依赖 Task 1 (类型) + Task 2 (难度表，验证表长度用)。

### 3a: 先写测试

- [ ] **Step 1: 写失败测试**

```ts
// tests/unit/questEngine.test.ts
import { describe, it, expect } from 'vitest';
import { pickNextGame, applyResult, isCleared, createInitialProgress } from '@/lib/questEngine';
import type { QuestProgress, QuestResult } from '@/types/quest';

const p = (s: number, q: number, t: number, b: number): QuestProgress['progress'] =>
  ({ schulte: s, sequence: q, stroop: t, bottle: b });

describe('pickNextGame', () => {
  it('全 0 时返回 4 个游戏之一', () => {
    const result = pickNextGame({ progress: p(0, 0, 0, 0) });
    expect(['schulte', 'sequence', 'stroop', 'bottle']).toContain(result);
  });

  it('舒尔特冒进到 5、其余 0 时，舒尔特被锁（6−1=5，5<3 假）', () => {
    for (let i = 0; i < 50; i++) {
      const result = pickNextGame({ progress: p(5, 0, 0, 0) });
      expect(result).not.toBe('schulte');
    }
  });

  it('舒尔特冒进到 2、其余 0 时，舒尔特仍可选（3−1=2，2<3 真）', () => {
    let schultePossible = false;
    for (let i = 0; i < 100; i++) {
      if (pickNextGame({ progress: p(2, 0, 0, 0) }) === 'schulte') schultePossible = true;
    }
    expect(schultePossible).toBe(true);
  });

  it('某游戏推满 10 后不再被抽到', () => {
    for (let i = 0; i < 50; i++) {
      const result = pickNextGame({ progress: p(10, 0, 0, 0) });
      expect(result).not.toBe('schulte');
    }
  });

  it('全满时返回 null', () => {
    const result = pickNextGame({ progress: p(10, 10, 10, 10) });
    expect(result).toBeNull();
  });

  it('最坏连撞 ≤ 3 次：舒尔特连抽 3 次后（progress=3），第 4 次必被锁', () => {
    // progress=3 → nextDiff=4，minNext=1（其他为0→1），4-1=3，3<3 为假 → 锁
    for (let i = 0; i < 50; i++) {
      const result = pickNextGame({ progress: p(3, 0, 0, 0) });
      expect(result).not.toBe('schulte');
    }
  });
});

describe('applyResult', () => {
  const baseResult = (overides: Partial<QuestResult>): QuestResult => ({
    gameId: 'schulte',
    difficulty: 1,
    passed: true,
    stars: 1,
    score: 100,
    details: {},
    ...overides,
  });

  it('完成新难度时 progress[g] 更新为该难度', () => {
    const initial = createInitialProgress();
    const updated = applyResult(initial, baseResult({ gameId: 'schulte', difficulty: 3, stars: 2 }));
    expect(updated.progress.schulte).toBe(3);
    expect(updated.stars['schulte-3']).toBe(2);
  });

  it('progress 只增不减（防回退）', () => {
    const initial: QuestProgress = { id: 'singleton', progress: p(5, 0, 0, 0), stars: {}, completed: false };
    const updated = applyResult(initial, baseResult({ gameId: 'schulte', difficulty: 2, stars: 3 }));
    expect(updated.progress.schulte).toBe(5); // 不回退到 2
  });

  it('stars 只留最好（取 max）', () => {
    const initial: QuestProgress = {
      id: 'singleton', progress: p(3, 0, 0, 0), stars: { 'schulte-3': 2 }, completed: false,
    };
    const updated = applyResult(initial, baseResult({ gameId: 'schulte', difficulty: 3, stars: 1 }));
    expect(updated.stars['schulte-3']).toBe(2); // 原 2 星，新 1 星，取 max=2
  });

  it('4 个全满时 completed=true', () => {
    const initial: QuestProgress = {
      id: 'singleton', progress: p(10, 10, 10, 9), stars: {}, completed: false,
    };
    const updated = applyResult(initial, baseResult({ gameId: 'bottle', difficulty: 10, stars: 3 }));
    expect(updated.progress.bottle).toBe(10);
    expect(updated.completed).toBe(true);
  });
});

describe('isCleared', () => {
  it('4 个全为 10 时返回 true', () => {
    expect(isCleared({ progress: p(10, 10, 10, 10) })).toBe(true);
  });

  it('有未满时返回 false', () => {
    expect(isCleared({ progress: p(10, 10, 10, 9) })).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd brain-train && npx vitest run tests/unit/questEngine.test.ts`
Expected: FAIL — 模块 `@/lib/questEngine` 不存在

### 3b: 实现引擎

- [ ] **Step 3: 写实现**

```ts
// src/lib/questEngine.ts
import type { GameId, QuestProgress, QuestResult } from '@/types/quest';
import { GAME_IDS } from '@/types/quest';

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
 * 候选 = nextDifficulty - minNext < 3 的未推满游戏。
 * @returns GameId 或 null（已全满）
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

/** 应用一关结果到进度（不可变，返回新对象） */
export function applyResult(progress: QuestProgress, result: QuestResult): QuestProgress {
  const newGameProgress = Math.max(progress.progress[result.gameId], result.difficulty);
  const key = `${result.gameId}-${result.difficulty}`;
  const prevStars = progress.stars[key] ?? 0;
  const newStars = Math.max(prevStars, result.stars) as 0 | 1 | 2 | 3;

  const updatedProgress = { ...progress.progress, [result.gameId]: newGameProgress };
  return {
    ...progress,
    progress: updatedProgress,
    stars: { ...progress.stars, [key]: newStars },
    completed: isCleared({ progress: updatedProgress }),
  };
}

/** 4 个游戏是否全满 */
export function isCleared(progress: Pick<QuestProgress, 'progress'>): boolean {
  return GAME_IDS.every((g) => progress.progress[g] >= 10);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd brain-train && npx vitest run tests/unit/questEngine.test.ts`
Expected: PASS — 全部用例

- [ ] **Step 5: Commit**

```bash
git add tests/unit/questEngine.test.ts src/lib/questEngine.ts
git commit -m "feat(quest): 实现抽游戏引擎（pickNextGame/applyResult/isCleared）+ 单测"
```

---

## Task 4: IndexedDB v4 + 存档读写

**Files:**
- Modify: `src/db/index.ts`
- Modify: `src/db/queries.ts`

依赖 Task 1（QuestProgress 类型）。

- [ ] **Step 1: db/index.ts bump 到 v4 并加表**

在 `src/db/index.ts` 的 `BrainTrainDB` class 中：

a) 加 import：
```ts
import type { UserProfile, TrainingRecord, DailyGoal, SchulteQuestProgress, QuestProgress } from '../types';
```

b) 加 Table 声明（在 `schulteQuestProgress!` 后面加）：
```ts
  questProgress!: Table<QuestProgress>;
```

c) 在 v3 的 `.stores(...)` 调用后加 v4：
```ts
    // v4: 新增主线闯关进度表（singleton 主键，使用 put）
    this.version(4).stores({
      userProfile: 'id',
      trainingRecords: 'id, mode, startedAt, [mode+startedAt]',
      dailyGoals: 'date',
      schulteQuestProgress: 'id',
      questProgress: 'id',
    });
```

- [ ] **Step 2: db/queries.ts 加读写函数**

在 `src/db/queries.ts` 文件末尾追加（import 行加 `QuestProgress`）：

a) 修改第 2 行 import，追加 QuestProgress：
```ts
import type { UserProfile, TrainingRecord, DailyGoal, TrainingMode, Statistics, SchulteQuestProgress, QuestProgress } from '../types';
```

b) 文件末尾追加：
```ts
// 主线闯关进度（Quest Mode）：独立于舒尔特闯关，singleton 主键

export function createInitialQuestProgress(): QuestProgress {
  return {
    id: 'singleton',
    progress: { schulte: 0, sequence: 0, stroop: 0, bottle: 0 },
    stars: {},
    completed: false,
  };
}

export async function getQuestProgressRecord(): Promise<QuestProgress> {
  const record = await db.questProgress.get('singleton');
  return record ?? createInitialQuestProgress();
}

export async function saveQuestProgressRecord(progress: QuestProgress): Promise<void> {
  await db.questProgress.put(progress);
}
```

- [ ] **Step 3: 验证编译 + 类型**

Run: `cd brain-train && npx tsc -b`
Expected: 0 errors

- [ ] **Step 4: 运行全部测试确认无回归**

Run: `cd brain-train && npx vitest run`
Expected: 所有现有测试 PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/index.ts src/db/queries.ts
git commit -m "feat(quest): IndexedDB v4 新增 questProgress 表 + 存档读写"
```

---

## Task 5: SequenceGame 增强难度维度

**Files:**
- Modify: `src/components/game/SequenceGame.tsx`

纯增量：加 3 个可选 prop，不传时行为完全等同现状。

- [ ] **Step 1: 扩展 Props 接口**

在 `SequenceGameProps` 接口中加入新 prop（现有 `sequenceLength` / `onComplete` / `isActive` 保留）：

```ts
interface SequenceGameProps {
  sequenceLength: number;
  onComplete: (result: {
    sequence: string[];
    userSequence: string[];
    positionAccuracy: number;
    itemAccuracy: number;
  }) => void;
  isActive: boolean;
  displayMode?: 'step' | 'flash';    // 新增：step=逐个亮起（默认），flash=整段闪现
  distractors?: number;              // 新增：回忆阶段混入的错误选项数（默认 0）
  answerTimeLimit?: number;          // 新增：回忆阶段总限时秒数（默认无限制）
}
```

- [ ] **Step 2: 解构新 prop 并设默认值**

修改组件函数签名：
```ts
export function SequenceGame({
  sequenceLength,
  onComplete,
  isActive,
  displayMode = 'step',
  distractors = 0,
  answerTimeLimit,
}: SequenceGameProps) {
```

- [ ] **Step 3: 实现干扰项（distractors）**

回忆阶段的选项池 `shuffledOptions` 改为从 `ITEMS_POOL` 额外取 `distractors` 个不在序列中的 emoji 混入：

找到现有 `shuffledOptions` 的 useMemo（约第 50 行），替换为：
```ts
  const shuffledOptions = useMemo(() => {
    const baseOptions = [...sequence];
    if (distractors > 0) {
      const used = new Set(sequence);
      const pool = ITEMS_POOL.filter((item) => !used.has(item));
      const shuffledPool = pool.sort(() => Math.random() - 0.5);
      baseOptions.push(...shuffledPool.slice(0, distractors));
    }
    return baseOptions.sort(() => Math.random() - 0.5);
  }, [sequence, distractors]);
```

- [ ] **Step 4: 实现整段闪现（displayMode='flash'）**

在记忆阶段，`flash` 模式一次性显示整个序列 2 秒后进入回忆。找到记忆阶段的 JSX（`{phase === 'memorize' && (` 块），在内部按 `displayMode` 分支：

```tsx
      {/* 记忆阶段 */}
      {phase === 'memorize' && (
        <div className="relative">
          <div className="aspect-square bg-surface-container-low rounded-2xl flex items-center justify-center shadow-inner mb-4">
            {displayMode === 'flash' ? (
              <FlashMemorize
                sequence={sequence}
                onDone={handleMemorizeComplete}
              />
            ) : (
              <AnimatePresence mode="wait">
                {sequence.slice(0, currentIndex + 1).map((item, index) => (
                  index === currentIndex && (
                    <motion.span
                      key={`${item}-${index}`}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="text-8xl"
                      onAnimationComplete={() => {
                        setTimeout(() => {
                          if (currentIndex < sequence.length - 1) {
                            setCurrentIndex(prev => prev + 1);
                          } else {
                            setTimeout(handleMemorizeComplete, 1000);
                          }
                        }, 800);
                      }}
                    >
                      {item}
                    </motion.span>
                  )
                ))}
              </AnimatePresence>
            )}
          </div>
          <p className="text-center text-sm text-muted-foreground">
            记住物品出现的顺序
          </p>
        </div>
      )}
```

在文件中（`SequenceGame` 组件定义之后、`export { ITEMS_POOL }` 之前）加入辅助组件：

```tsx
// flash 模式：整段序列同时显示 2 秒后结束
function FlashMemorize({ sequence, onDone }: { sequence: string[]; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="flex flex-wrap justify-center gap-3 p-4 max-w-md">
      {sequence.map((item, index) => (
        <motion.span
          key={`${item}-${index}`}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: index * 0.05 }}
          className="text-5xl"
        >
          {item}
        </motion.span>
      ))}
    </div>
  );
}
```

注意：`SequenceGame.tsx` 顶部已 import `useEffect`？检查——当前 import 是 `import { useState, useCallback, useMemo } from 'react';`。需改为：
```ts
import { useState, useCallback, useMemo, useEffect } from 'react';
```

- [ ] **Step 5: 实现回答限时（answerTimeLimit）**

在回忆阶段加倒计时。在组件内 `handleItemSelect` 之前加入 effect 和状态：

```ts
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (phase === 'recall' && answerTimeLimit) {
      setTimeLeft(answerTimeLimit);
      const interval = setInterval(() => {
        setTimeLeft((t) => {
          if (t === null) return null;
          if (t <= 1) {
            clearInterval(interval);
            // 超时自动提交当前已选序列（未选满则按错处理）
            onComplete({
              sequence,
              userSequence,
              positionAccuracy: 0,
              itemAccuracy: 0,
            });
            return 0;
          }
          return t - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, answerTimeLimit]);
```

在回忆阶段 JSX 的阶段指示器区域（进度条上方）加入倒计时显示（仅当 answerTimeLimit 存在）：

```tsx
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>回忆阶段</span>
            <span>
              {answerTimeLimit && timeLeft !== null && timeLeft > 0
                ? `${timeLeft}s`
                : `${userSequence.length} / ${sequence.length}`}
            </span>
          </div>
```

- [ ] **Step 6: 验证编译**

Run: `cd brain-train && npx tsc -b`
Expected: 0 errors

- [ ] **Step 7: 手测自由模式零回归**

Run: `cd brain-train && npm run dev`，打开 Sequence 游戏，确认不传新 prop 时行为与改动前完全一致（逐个亮起、无干扰、无倒计时）。

- [ ] **Step 8: Commit**

```bash
git add src/components/game/SequenceGame.tsx
git commit -m "feat(sequence): 增强难度维度（displayMode/distractors/answerTimeLimit）"
```

---

## Task 6: StroopGame 增强难度维度

**Files:**
- Modify: `src/components/game/StroopGame.tsx`

加 `mode` 和 `timePerQuestion` 两个可选 prop。`mode` 决定每题的判断规则；`timePerQuestion` 限时（超时算错）。

注意：`StroopGame` 只渲染单题，完成流程由调用方管理（自由模式 `Stroop.tsx` 或主线 `QuestStroopRunner`）。`onAnswer` 回调签名不变，保持兼容。

- [ ] **Step 1: 扩展 Props 接口**

```ts
interface StroopGameProps {
  isActive: boolean;
  onAnswer: (question: StroopQuestion) => void;
  currentQuestion: number;
  totalQuestions: number;
  mode?: 'standard' | 'reverse' | 'dual';    // 新增
  timePerQuestion?: number;                   // 新增：秒
}
```

- [ ] **Step 2: 解构 prop**

```ts
export function StroopGame({
  isActive,
  onAnswer,
  currentQuestion,
  totalQuestions,
  mode = 'standard',
  timePerQuestion,
}: StroopGameProps) {
```

- [ ] **Step 3: 实现每题规则（mode）**

`dual` 模式下每题随机选 standard 或 reverse 规则；`standard`/`reverse` 固定。当前题目规则需传给渲染层，决定提示文案和判分。

在生成当前题目 `current` 的 useMemo 之后，加入本题规则计算：

```ts
  // 本题的判断规则（dual 模式每题随机）
  const rule = useMemo<'standard' | 'reverse'>(() => {
    if (mode === 'dual') return Math.random() < 0.5 ? 'standard' : 'reverse';
    return mode;
  }, [mode, currentQuestion]);
```

判分逻辑修改：`standard` = 选文字的**颜色**（现有逻辑）；`reverse` = 选文字的**含义**（字面名称）。修改 `handleAnswer`：

```ts
  const handleAnswer = useCallback((selectedColorName: string) => {
    if (!isActive) return;
    const reactionTime = Date.now() - questionStartTime;
    // standard: 答案是文字显示的颜色名；reverse: 答案是文字本身的字面名
    const correctAnswer = rule === 'standard' ? current.wordColorName : current.word;
    const isCorrect = selectedColorName === correctAnswer;

    onAnswer({
      word: current.word,
      wordColor: current.wordColorName,
      userAnswer: selectedColorName,
      reactionTime,
      isCorrect,
    });
  }, [current, isActive, onAnswer, questionStartTime, rule]);
```

- [ ] **Step 4: 实现每题限时（timePerQuestion）**

在组件内加入倒计时 effect：

```ts
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!timePerQuestion || !isActive) {
      setTimeLeft(null);
      return;
    }
    setTimeLeft(timePerQuestion);
    const timer = setTimeout(() => {
      // 超时算错
      onAnswer({
        word: current.word,
        wordColor: current.wordColorName,
        userAnswer: '',
        reactionTime: timePerQuestion * 1000,
        isCorrect: false,
      });
    }, timePerQuestion * 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion, timePerQuestion]);
```

- [ ] **Step 5: 更新提示文案与倒计时 UI**

找到题目区域的提示 `<p>`（约第 105 行 `忽略文字含义，选择文字的颜色`），替换为按规则显示：

```tsx
        <p className="text-center text-xs text-muted-foreground mt-3">
          {rule === 'standard'
            ? <>忽略文字含义，选择<span className="font-bold text-foreground">文字的颜色</span></>
            : <>忽略文字颜色，选择<span className="font-bold text-foreground">文字的含义</span></>
          }
          {timePerQuestion && timeLeft !== null && (
            <span className="ml-2 font-mono font-bold text-primary">{timeLeft}s</span>
          )}
        </p>
```

- [ ] **Step 6: 验证编译**

Run: `cd brain-train && npx tsc -b`
Expected: 0 errors

- [ ] **Step 7: 手测自由模式零回归**

`npm run dev` 打开 Stroop，确认不传 mode/timePerQuestion 时与改动前完全一致。

- [ ] **Step 8: Commit**

```bash
git add src/components/game/StroopGame.tsx
git commit -m "feat(stroop): 增强难度维度（mode standard/reverse/dual + timePerQuestion）"
```

---

## Task 7: BottleGame 加 timeLimit + 删下排

**Files:**
- Modify: `src/components/game/BottleGame.tsx`

- [ ] **Step 1: 扩展 Props 加 timeLimit**

```ts
interface BottleGameProps {
  bottleCount: number;
  isActive: boolean;
  startTime: number;
  onSwap: (matchCount: number) => void;
  onComplete: (totalSwaps: number, optimalSwaps: number, targetSeq: string[], playerSeq: string[]) => void;
  timeLimit?: number;  // 新增：秒，限时模式
}
```

解构加入 `timeLimit`。

- [ ] **Step 2: 加限时倒计时 + 超时强制完成**

在组件内（现有 effect 之后）加：

```ts
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!isActive || !timeLimit || completedRef.current) {
      setTimeLeft(null);
      return;
    }
    setTimeLeft(timeLimit);
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t === null) return null;
        if (t <= 1) {
          clearInterval(interval);
          // 超时：按当前状态强制完成
          if (!completedRef.current) {
            completedRef.current = true;
            onComplete(swapCountRef.current, optimal, target, playerSequence);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, timeLimit]);
```

- [ ] **Step 3: 删除下排灰瓶 JSX**

阅读 `BottleGame.tsx` 的 return 部分，找到渲染**下排**（targetSequence 灰色 `?` 瓶子）的 JSX 块并整体删除。仅保留上排彩色可交互瓶子。

具体操作：在 return JSX 中搜索渲染 `target` 作为隐藏占位的块（通常带 `?` 字符和灰色样式），删除该块。保留顶部 `matchCount` 反馈（那是 spec 要求保留的反馈来源）。

在棋盘区域顶部加入限时显示（若 timeLeft 存在）：

```tsx
      {timeLeft !== null && timeLimit && (
        <div className="text-center mb-3 font-mono font-bold text-lg">
          剩余 {timeLeft}s
        </div>
      )}
```

- [ ] **Step 4: 验证编译**

Run: `cd brain-train && npx tsc -b`
Expected: 0 errors

- [ ] **Step 5: 手测自由模式零回归**

`npm run dev` 打开 Bottle，确认不传 timeLimit 时无倒计时、下排已删除（顶部 matchCount 仍在）。

- [ ] **Step 6: 运行现有 BottleGame 测试**

Run: `cd brain-train && npx vitest run tests/unit/BottleGame.test.tsx`
Expected: PASS（如有快照断言依赖下排 DOM，需更新快照或断言）

- [ ] **Step 7: Commit**

```bash
git add src/components/game/BottleGame.tsx
git commit -m "feat(bottle): 加 timeLimit 限时 + 删除无信息承载的下排灰瓶"
```

---

## Task 8: 4 个 Runner 适配器 + 分发器

**Files:**
- Create: `src/components/quest/QuestSchulteRunner.tsx`
- Create: `src/components/quest/QuestSequenceRunner.tsx`
- Create: `src/components/quest/QuestStroopRunner.tsx`
- Create: `src/components/quest/QuestBottleRunner.tsx`
- Create: `src/components/quest/QuestRunner.tsx`
- Create: `src/components/quest/index.ts`

依赖 Task 1-7（类型、难度表、增强后的组件）。

每个 Runner 接收 `{ difficulty, onComplete }`，查难度表翻译参数，渲染原组件，监听完成回调，算星级，产出 QuestResult。

### 8a: 统一的 Runner Props 和星级工具

- [ ] **Step 1: 创建 QuestRunner.tsx 分发器（含公共类型）**

```tsx
// src/components/quest/QuestRunner.tsx
import type { GameId, QuestResult } from '@/types/quest';
import { QuestSchulteRunner } from './QuestSchulteRunner';
import { QuestSequenceRunner } from './QuestSequenceRunner';
import { QuestStroopRunner } from './QuestStroopRunner';
import { QuestBottleRunner } from './QuestBottleRunner';

export interface RunnerProps {
  difficulty: number;
  onComplete: (result: QuestResult) => void;
}

const RUNNERS: Record<GameId, React.ComponentType<RunnerProps>> = {
  schulte: QuestSchulteRunner,
  sequence: QuestSequenceRunner,
  stroop: QuestStroopRunner,
  bottle: QuestBottleRunner,
};

export function QuestRunner({
  gameId,
  difficulty,
  onComplete,
}: { gameId: GameId } & RunnerProps) {
  const Runner = RUNNERS[gameId];
  return <Runner difficulty={difficulty} onComplete={onComplete} />;
}
```

### 8b: Schulte Runner（最简单，复用 computeStars/computeScore）

- [ ] **Step 2: 创建 QuestSchulteRunner.tsx**

```tsx
// src/components/quest/QuestSchulteRunner.tsx
import { useCallback } from 'react';
import { SchulteGrid } from '@/components/game/SchulteGrid';
import { getDifficulty } from '@/lib/questGameConfig';
import { computeStars, computeScore } from '@/lib/schulteQuestConfig';
import type { SchulteDifficultyParams, QuestResult } from '@/types/quest';
import type { RunnerProps } from './QuestRunner';

export function QuestSchulteRunner({ difficulty, onComplete }: RunnerProps) {
  const level = getDifficulty('schulte', difficulty);
  const { gridSize, direction, timeLimitPerNumber, lives } = level.params as SchulteDifficultyParams;

  const handleComplete = useCallback((maxCombo: number, errorCount: number, remainingTime: number) => {
    const passed = true;
    const stars = computeStars({
      passed,
      maxCombo,
      errorCount,
      comboTarget: level.comboTarget ?? 10,
    });
    const score = computeScore({
      level: difficulty,
      timeLimitPerNumber,
      maxCombo,
      remainingTime,
    });
    const result: QuestResult = {
      gameId: 'schulte',
      difficulty,
      passed,
      stars,
      score,
      details: { maxCombo, errorCount, remainingTime },
    };
    onComplete(result);
  }, [difficulty, level, onComplete, timeLimitPerNumber]);

  return (
    <SchulteGrid
      gridSize={gridSize}
      direction={direction}
      timeLimitPerNumber={timeLimitPerNumber}
      lives={lives}
      onComplete={handleComplete}
    />
  );
}
```

⚠️ **注意：** 执行时需先确认 `SchulteGrid` 的实际 prop 签名（`onComplete` 参数顺序、是否有 `comboTarget` 等）。上面基于 spec §6.6 的 `onComplete(combo, errors, time)`。若签名不符，以实际 `SchulteGrid.tsx` 为准调整。

### 8c: Sequence Runner

- [ ] **Step 3: 创建 QuestSequenceRunner.tsx**

```tsx
// src/components/quest/QuestSequenceRunner.tsx
import { useCallback } from 'react';
import { SequenceGame } from '@/components/game/SequenceGame';
import { getDifficulty } from '@/lib/questGameConfig';
import type { SequenceDifficultyParams, QuestResult } from '@/types/quest';
import type { RunnerProps } from './QuestRunner';

export function QuestSequenceRunner({ difficulty, onComplete }: RunnerProps) {
  const level = getDifficulty('sequence', difficulty);
  const { sequenceLength, displayMode, distractors, answerTimeLimit } =
    level.params as SequenceDifficultyParams;

  const handleComplete = useCallback((result: {
    sequence: string[];
    userSequence: string[];
    positionAccuracy: number;
    itemAccuracy: number;
  }) => {
    const accuracy = result.positionAccuracy * 0.6 + result.itemAccuracy * 0.4;
    let stars: 0 | 1 | 2 | 3 = 1;
    if (accuracy >= level.excellentThreshold) stars = 3;
    else if (accuracy >= level.goodThreshold) stars = 2;

    onComplete({
      gameId: 'sequence',
      difficulty,
      passed: true,
      stars,
      score: Math.round(accuracy),
      details: result,
    });
  }, [difficulty, level, onComplete]);

  return (
    <SequenceGame
      sequenceLength={sequenceLength}
      isActive={true}
      displayMode={displayMode}
      distractors={distractors}
      answerTimeLimit={answerTimeLimit}
      onComplete={handleComplete}
    />
  );
}
```

### 8d: Stroop Runner（自带流程管理）

Stroop Runner 要自己管题目循环（因为 StroopGame 只渲染单题）。参考现有 `Stroop.tsx` 的流程逻辑。

- [ ] **Step 4: 创建 QuestStroopRunner.tsx**

```tsx
// src/components/quest/QuestStroopRunner.tsx
import { useState, useCallback, useMemo } from 'react';
import { StroopGame } from '@/components/game/StroopGame';
import { getDifficulty } from '@/lib/questGameConfig';
import type { StroopDifficultyParams, QuestResult } from '@/types/quest';
import type { StroopQuestion } from '@/types';
import type { RunnerProps } from './QuestRunner';

export function QuestStroopRunner({ difficulty, onComplete }: RunnerProps) {
  const level = getDifficulty('stroop', difficulty);
  const { questionCount, mode, timePerQuestion } = level.params as StroopDifficultyParams;

  const [questions, setQuestions] = useState<StroopQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  const handleAnswer = useCallback((question: StroopQuestion) => {
    const allQuestions = [...questions, question];
    setQuestions(allQuestions);

    if (currentIdx + 1 >= questionCount) {
      // 全部答完，结算
      const correctCount = allQuestions.filter((q) => q.isCorrect).length;
      const accuracy = (correctCount / questionCount) * 100;
      let stars: 0 | 1 | 2 | 3 = 1;
      if (accuracy >= level.excellentThreshold) stars = 3;
      else if (accuracy >= level.goodThreshold) stars = 2;

      const result: QuestResult = {
        gameId: 'stroop',
        difficulty,
        passed: true,
        stars,
        score: Math.round(accuracy),
        details: { questionCount, correctCount, accuracy },
      };
      onComplete(result);
    } else {
      setCurrentIdx((i) => i + 1);
    }
  }, [questions, currentIdx, questionCount, level, difficulty, onComplete]);

  return (
    <StroopGame
      isActive={true}
      onAnswer={handleAnswer}
      currentQuestion={currentIdx}
      totalQuestions={questionCount}
      mode={mode}
      timePerQuestion={timePerQuestion}
    />
  );
}
```

### 8e: Bottle Runner

- [ ] **Step 5: 创建 QuestBottleRunner.tsx**

```tsx
// src/components/quest/QuestBottleRunner.tsx
import { useState, useCallback } from 'react';
import { BottleGame } from '@/components/game/BottleGame';
import { getDifficulty } from '@/lib/questGameConfig';
import type { BottleDifficultyParams, QuestResult } from '@/types/quest';
import type { RunnerProps } from './QuestRunner';

export function QuestBottleRunner({ difficulty, onComplete }: RunnerProps) {
  const level = getDifficulty('bottle', difficulty);
  const { bottleCount, timeLimit } = level.params as BottleDifficultyParams;
  const [startTime] = useState(() => Date.now());

  const handleComplete = useCallback((totalSwaps: number, optimalSwaps: number) => {
    let stars: 0 | 1 | 2 | 3 = 1;
    if (totalSwaps <= optimalSwaps * level.excellentThreshold) stars = 3;
    else if (totalSwaps <= optimalSwaps * level.goodThreshold) stars = 2;

    onComplete({
      gameId: 'bottle',
      difficulty,
      passed: true,
      stars,
      score: optimalSwaps > 0 ? Math.round((optimalSwaps / totalSwaps) * 100) : 100,
      details: { totalSwaps, optimalSwaps },
    });
  }, [difficulty, level, onComplete]);

  return (
    <BottleGame
      bottleCount={bottleCount}
      isActive={true}
      startTime={startTime}
      timeLimit={timeLimit}
      onSwap={() => {}}
      onComplete={handleComplete}
    />
  );
}
```

### 8f: barrel export

- [ ] **Step 6: 创建 index.ts**

```ts
// src/components/quest/index.ts
export { QuestRunner } from './QuestRunner';
export type { RunnerProps } from './QuestRunner';
export { QuestHub } from './QuestHub';
export { QuestHUD } from './QuestHUD';
export { QuestResultDialog } from './QuestResultDialog';
```

注：`QuestHub` / `QuestHUD` / `QuestResultDialog` 在 Task 9 创建，此 index 暂时引用未定义的导出会导致编译错误——**Task 9 完成前不要运行 tsc**。或者把 index.ts 留到 Task 9 最后创建。

⚠️ **调整：将 index.ts 的创建移到 Task 9 Step 末尾，避免编译错误。**

- [ ] **Step 7: 验证编译（此时跳过 index.ts）**

Run: `cd brain-train && npx tsc -b`
Expected: 0 errors（index.ts 尚未创建）

- [ ] **Step 8: Commit**

```bash
git add src/components/quest/QuestSchulteRunner.tsx src/components/quest/QuestSequenceRunner.tsx src/components/quest/QuestStroopRunner.tsx src/components/quest/QuestBottleRunner.tsx src/components/quest/QuestRunner.tsx
git commit -m "feat(quest): 4 游戏 Runner 适配器 + gameId 分发器"
```

---

## Task 9: Quest UI 组件（Hub / HUD / ResultDialog）

**Files:**
- Create: `src/components/quest/QuestHub.tsx`
- Create: `src/components/quest/QuestHUD.tsx`
- Create: `src/components/quest/QuestResultDialog.tsx`
- Create: `src/components/quest/index.ts`

### 9a: QuestHUD（进行中顶部条）

- [ ] **Step 1: 创建 QuestHUD.tsx**

```tsx
// src/components/quest/QuestHUD.tsx
import type { GameId } from '@/types/quest';

const GAME_NAMES: Record<GameId, string> = {
  schulte: '舒尔特表',
  sequence: '序列记忆',
  stroop: '字色干扰',
  bottle: '暗瓶排列',
};

interface QuestHUDProps {
  gameId: GameId;
  difficulty: number;
  onExit: () => void;
}

export function QuestHUD({ gameId, difficulty, onExit }: QuestHUDProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-surface-container rounded-2xl mb-4">
      <div className="flex items-center gap-3">
        <span className="font-headline font-bold text-foreground">{GAME_NAMES[gameId]}</span>
        <span className="text-sm text-muted-foreground">难度 {difficulty} / 10</span>
      </div>
      <button
        onClick={onExit}
        className="px-3 py-1.5 text-sm rounded-lg bg-surface hover:bg-surface-container-high transition-colors"
      >
        退出
      </button>
    </div>
  );
}
```

### 9b: QuestHub（关卡大厅）

- [ ] **Step 2: 创建 QuestHub.tsx**

```tsx
// src/components/quest/QuestHub.tsx
import type { QuestProgress, GameId } from '@/types/quest';
import { GAME_IDS } from '@/types/quest';

const GAME_NAMES: Record<GameId, string> = {
  schulte: '舒尔特表',
  sequence: '序列记忆',
  stroop: '字色干扰',
  bottle: '暗瓶排列',
};

interface QuestHubProps {
  progress: QuestProgress;
  onStart: () => void;
  onBack: () => void;
}

export function QuestHub({ progress, onStart, onBack }: QuestHubProps) {
  const totalCleared = GAME_IDS.reduce((sum, g) => sum + progress.progress[g], 0);
  const totalStars = Object.values(progress.stars).reduce((sum, s) => sum + s, 0);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-headline text-3xl font-extrabold text-foreground">主线闯关</h1>
          <p className="text-muted-foreground text-sm mt-1">
            已完成 {totalCleared}/40 关 · 累计 {totalStars} 星
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors"
        >
          返回
        </button>
      </div>

      {/* 4 游戏进度 */}
      <div className="space-y-4 mb-8">
        {GAME_IDS.map((g) => {
          const cleared = progress.progress[g];
          return (
            <div key={g} className="bg-surface-container rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-foreground">{GAME_NAMES[g]}</span>
                <span className="text-sm text-muted-foreground">{cleared}/10</span>
              </div>
              <div className="h-2 bg-accent rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(cleared / 10) * 100}%` }}
                />
              </div>
              {/* 已通过关卡的星级 */}
              <div className="flex gap-1 mt-2">
                {Array.from({ length: 10 }, (_, i) => {
                  const stars = progress.stars[`${g}-${i + 1}`] ?? 0;
                  return (
                    <span key={i} className="text-xs">
                      {stars > 0 ? '★'.repeat(stars) : '·'}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {progress.completed ? (
        <div className="text-center py-8">
          <p className="text-2xl font-headline font-bold text-success mb-2">🎉 全部通关！</p>
          <p className="text-muted-foreground">共 {totalStars} 颗星</p>
        </div>
      ) : (
        <button
          onClick={onStart}
          className="w-full py-4 bg-primary text-primary-foreground font-bold text-lg rounded-2xl hover:opacity-90 transition-opacity"
        >
          开始下一关
        </button>
      )}
    </div>
  );
}
```

### 9c: QuestResultDialog（结算弹窗）

- [ ] **Step 3: 创建 QuestResultDialog.tsx**

```tsx
// src/components/quest/QuestResultDialog.tsx
import { motion } from 'framer-motion';
import type { QuestResult, GameId } from '@/types/quest';

const GAME_NAMES: Record<GameId, string> = {
  schulte: '舒尔特表',
  sequence: '序列记忆',
  stroop: '字色干扰',
  bottle: '暗瓶排列',
};

interface QuestResultDialogProps {
  result: QuestResult;
  isCleared: boolean;   // 是否全游戏通关
  onNext: () => void;   // 继续下一关
  onHub: () => void;    // 返回大厅
}

export function QuestResultDialog({ result, isCleared, onNext, onHub }: QuestResultDialogProps) {
  return (
    <div className="max-w-md mx-auto text-center py-12">
      {isCleared && (
        <p className="text-2xl font-headline font-black text-success mb-2">🎉 主线全部通关！</p>
      )}
      <h2 className="font-headline text-3xl font-extrabold text-foreground mb-4">关卡完成！</h2>

      {/* 星级动画 */}
      <div className="flex justify-center gap-2 mb-4">
        {[1, 2, 3].map((n) => (
          <motion.span
            key={n}
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: n * 0.2, type: 'spring' }}
            className={`text-5xl ${n <= result.stars ? 'text-yellow-400' : 'text-muted-foreground/30'}`}
          >
            ★
          </motion.span>
        ))}
      </div>

      <p className="text-muted-foreground mb-8">
        {GAME_NAMES[result.gameId]} · 难度 {result.difficulty}
      </p>

      <div className="flex gap-3">
        <button
          onClick={onHub}
          className="flex-1 py-3 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors font-bold"
        >
          返回大厅
        </button>
        {!isCleared && (
          <button
            onClick={onNext}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-bold"
          >
            继续下一关
          </button>
        )}
      </div>
    </div>
  );
}
```

### 9d: barrel export

- [ ] **Step 4: 创建 index.ts（此时所有组件已存在）**

```ts
// src/components/quest/index.ts
export { QuestRunner } from './QuestRunner';
export type { RunnerProps } from './QuestRunner';
export { QuestHub } from './QuestHub';
export { QuestHUD } from './QuestHUD';
export { QuestResultDialog } from './QuestResultDialog';
```

- [ ] **Step 5: 验证编译**

Run: `cd brain-train && npx tsc -b`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/components/quest/QuestHUD.tsx src/components/quest/QuestHub.tsx src/components/quest/QuestResultDialog.tsx src/components/quest/index.ts
git commit -m "feat(quest): QuestHub/QuestHUD/QuestResultDialog 组件"
```

---

## Task 10: Quest.tsx 状态机 + 路由 + 首页双入口

**Files:**
- Create: `src/pages/Quest.tsx`
- Modify: `src/App.tsx`

### 10a: Quest.tsx 页面状态机

- [ ] **Step 1: 创建 Quest.tsx**

```tsx
// src/pages/Quest.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuestHub, QuestHUD, QuestRunner, QuestResultDialog } from '@/components/quest';
import { pickNextGame, applyResult, createInitialProgress } from '@/lib/questEngine';
import { getQuestProgressRecord, saveQuestProgressRecord } from '@/db/queries';
import type { QuestProgress, GameId, QuestResult } from '@/types/quest';

type View = 'hub' | 'playing' | 'result';

export function Quest() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<QuestProgress | null>(null);
  const [view, setView] = useState<View>('hub');
  const [currentGame, setCurrentGame] = useState<GameId | null>(null);
  const [currentDifficulty, setCurrentDifficulty] = useState(1);
  const [lastResult, setLastResult] = useState<QuestResult | null>(null);

  // 加载存档
  useEffect(() => {
    getQuestProgressRecord().then(setProgress);
  }, []);

  const handleStart = useCallback(() => {
    if (!progress) return;
    const game = pickNextGame(progress);
    if (!game) return;
    setCurrentGame(game);
    setCurrentDifficulty(progress.progress[game] + 1);
    setView('playing');
  }, [progress]);

  const handleComplete = useCallback(async (result: QuestResult) => {
    if (!progress) return;
    const updated = applyResult(progress, result);
    await saveQuestProgressRecord(updated);
    setProgress(updated);
    setLastResult(result);
    setView('result');
  }, [progress]);

  const handleNext = useCallback(() => {
    if (!progress) return;
    const game = pickNextGame(progress);
    if (!game) {
      setView('hub');
      return;
    }
    setCurrentGame(game);
    setCurrentDifficulty(progress.progress[game] + 1);
    setView('playing');
    setLastResult(null);
  }, [progress]);

  const handleExit = useCallback(() => {
    setView('hub');
    setCurrentGame(null);
    setLastResult(null);
  }, []);

  const handleBack = useCallback(() => navigate('/'), [navigate]);

  if (!progress) {
    return <div className="text-center py-12 text-muted-foreground">加载中…</div>;
  }

  if (view === 'hub') {
    return <QuestHub progress={progress} onStart={handleStart} onBack={handleBack} />;
  }

  if (view === 'playing' && currentGame) {
    return (
      <div className="max-w-3xl mx-auto">
        <QuestHUD gameId={currentGame} difficulty={currentDifficulty} onExit={handleExit} />
        <QuestRunner
          gameId={currentGame}
          difficulty={currentDifficulty}
          onComplete={handleComplete}
        />
      </div>
    );
  }

  // view === 'result'
  return (
    <QuestResultDialog
      result={lastResult!}
      isCleared={progress.completed}
      onNext={handleNext}
      onHub={handleExit}
    />
  );
}
```

### 10b: 路由 + 首页双入口

- [ ] **Step 2: App.tsx 加 import 和路由**

在 `src/App.tsx`：
a) 顶部 import 区加：
```ts
import { Quest } from './pages/Quest';
```

b) 在 `router` 的 children 数组中，`{ index: true, element: <Home /> }` 之后加：
```ts
      { path: 'quest', element: <Quest /> },
```

- [ ] **Step 3: 首页加入主线闯关入口卡**

在 `src/App.tsx` 的 `Home` 组件中，在「训练模式」section（`{games.map(...)}` 的 grid）**之前**插入主线入口卡 section：

```tsx
      {/* 主线闯关入口 */}
      <section className="mb-8">
        <button
          onClick={() => navigate('/quest')}
          className="w-full p-6 bg-gradient-to-br from-primary/90 to-primary text-primary-foreground rounded-3xl text-left hover:opacity-95 transition-opacity shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-headline text-2xl font-extrabold mb-1">主线闯关</h2>
              <p className="text-primary-foreground/80 text-sm">4 个游戏随机串联，由易到难，40 关挑战</p>
            </div>
            <span className="material-symbols-outlined text-4xl">arrow_forward</span>
          </div>
        </button>
      </section>
```

- [ ] **Step 4: 验证编译 + 构建**

Run: `cd brain-train && npx tsc -b && npm run build`
Expected: 0 errors, build success

- [ ] **Step 5: Commit**

```bash
git add src/pages/Quest.tsx src/App.tsx
git commit -m "feat(quest): Quest 页面状态机 + /quest 路由 + 首页双入口"
```

---

## Task 11: 集成验证 + 自由模式回归

**Files:**
- Test: `tests/unit/questGameConfig.test.ts`（难度表完整性）

- [ ] **Step 1: 写难度表完整性测试**

```ts
// tests/unit/questGameConfig.test.ts
import { describe, it, expect } from 'vitest';
import {
  SCHULTE_DIFFICULTIES,
  SEQUENCE_DIFFICULTIES,
  STROOP_DIFFICULTIES,
  BOTTLE_DIFFICULTIES,
  getDifficulty,
} from '@/lib/questGameConfig';
import { GAME_IDS } from '@/types/quest';

const TABLES: Record<string, ReturnType<() => typeof SCHULTE_DIFFICULTIES>> = {
  schulte: SCHULTE_DIFFICULTIES,
  sequence: SEQUENCE_DIFFICULTIES,
  stroop: STROOP_DIFFICULTIES,
  bottle: BOTTLE_DIFFICULTIES,
};

describe('questGameConfig 难度表完整性', () => {
  it('4 张表各 10 级', () => {
    GAME_IDS.forEach((g) => {
      expect(TABLES[g]).toHaveLength(10);
    });
  });

  it('每级 difficulty 从 1 到 10 连续', () => {
    GAME_IDS.forEach((g) => {
      TABLES[g].forEach((level, i) => {
        expect(level.difficulty).toBe(i + 1);
      });
    });
  });

  it('每级都有 goodThreshold 和 excellentThreshold', () => {
    GAME_IDS.forEach((g) => {
      TABLES[g].forEach((level) => {
        expect(level.goodThreshold).toBeDefined();
        expect(level.excellentThreshold).toBeDefined();
      });
    });
  });

  it('getDifficulty 返回正确难度', () => {
    expect(getDifficulty('schulte', 1).difficulty).toBe(1);
    expect(getDifficulty('schulte', 10).difficulty).toBe(10);
    expect(getDifficulty('bottle', 5).difficulty).toBe(5);
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `cd brain-train && npx vitest run tests/unit/questGameConfig.test.ts`
Expected: PASS

- [ ] **Step 3: 运行全部测试**

Run: `cd brain-train && npx vitest run`
Expected: 全部 PASS（含新增 questEngine + questGameConfig，现有测试不回归）

- [ ] **Step 4: 完整验证三件套**

Run: `cd brain-train && npx tsc -b && npx vitest run && npm run build`
Expected: 全绿

- [ ] **Step 5: 手动集成测试**

`npm run dev`，验证：
1. 首页看到「主线闯关」大卡 + 下方「训练模式」4 游戏
2. 点主线闯关 → 进入 Hub → 点开始下一关 → 进入随机抽到的游戏
3. 完成游戏 → 星级结算 → 继续下一关 / 返回大厅
4. 退出中途 → 回 Hub → 进度未增加
5. 自由模式 4 游戏仍正常工作（零回归）
6. 刷新页面后进度仍在（IndexedDB 持久化）

- [ ] **Step 6: Commit**

```bash
git add tests/unit/questGameConfig.test.ts
git commit -m "test(quest): 难度表完整性测试 + 集成验证通过"
```

---

## 完成标准

- [ ] 验证三件套全绿：`npx tsc -b`、`npx vitest run`、`npm run build`
- [ ] 自由模式 4 游戏零回归
- [ ] 主线闯关可从 0 关玩起，进度持久化
- [ ] 暗瓶下排灰瓶已删除
- [ ] Sequence 支持 distractors/displayMode/answerTimeLimit
- [ ] Stroop 支持 mode/timePerQuestion
- [ ] Bottle 支持 timeLimit
- [ ] 推送分支 + 开 PR（遵循 git-workflow 技能）
