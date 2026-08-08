# 对战多游戏扩展（Versus Multi-Game）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把对战从「仅舒尔特 1v1」扩展为「舒尔特/字色/序列/暗瓶」四种游戏 + 单局/多局本轮制编排。

**Architecture:** 服务端抽出 `GameEngine` 统一接口，每游戏一个引擎模块（generateSeed/applyAction/finalize/computePercent），`roomHandlers` 用 `ENGINES[mode]` 分派；前端复用现有单机游戏组件，薄封装成对战棋盘，按 `gameMode` 分派渲染。

**Tech Stack:** Node.js + Express + Socket.IO + Postgres（后端）；React 19 + Vite + Zustand + Tailwind v4（前端）；vitest（测试，`pool: 'forks', singleFork: true` 串行）。

## Global Constraints

- ESM 项目，后端源码 import 必须带 `.js` 扩展名（如 `'../types/room.js'`）。
- 测试串行跑（DB 共享连接池）：`vitest.config.ts` 已是 `pool: 'forks', singleFork: true`，新测试文件无需改。
- 游戏参数固定预设，不让房主调：舒尔特 5×5/90s、字色 10 题/每题 8s/总 120s、序列长度 6/回忆 15s、暗瓶 6 瓶/180s。
- 随机内容服务端统一生成下发双方（同题同难度）。
- 前端 PWA SW 已禁用，前后端一次性发布，`game:tap`→`game:action` 重命名不做兼容期。
- 战绩：每完成一局 `recordMatch` 立即落库，退出不影响；房间内本轮队列（roundResults）在非房主退出时清空。
- 中文 UI 文案；代码注释用中文，跟现有风格一致。

---

## File Structure

### 后端新建
- `server/src/games/types.ts` — GameEngine 接口 + GameSeed/PlayerProgress/GameAction/FinalizedProgress 联合类型
- `server/src/games/registry.ts` — `ENGINES: Record<GameMode, GameEngine>` 单例
- `server/src/games/schulteEngine.ts` — 迁移现有 schulte 逻辑 + direction
- `server/src/games/stroopEngine.ts` — 字色引擎
- `server/src/games/sequenceEngine.ts` — 序列引擎
- `server/src/games/bottleEngine.ts` — 暗瓶引擎
- `server/src/games/gameState.ts` — 通用 RoomGame（取代 schulte 专属的 RoomGame）

### 后端修改
- `server/src/types/room.ts` — GameMode 扩展 + Room 加 roundMode/gameQueue/currentQueueIndex/roundResults/hostCanChangeGames + RoomCreateInput 扩展 + 新事件 payload 类型
- `server/src/types/schulte.ts` — 保留旧类型供迁移期引用（最后删除或留作 schulte detail）
- `server/src/rooms/roomHandlers.ts` — 用 ENGINES 分派，game:tap→game:action，结算分派，多局推进，reconfigure，退出清空本轮
- `server/src/rooms/roomHelpers.ts` — toRoomStatePayload/toPublicRoom 加新字段
- `server/src/rooms/roomStore.ts` — create 加 roundMode/games 参数

### 后端测试新建
- `server/tests/games/registry.test.ts`
- `server/tests/games/schulteEngine.test.ts`
- `server/tests/games/stroopEngine.test.ts`
- `server/tests/games/sequenceEngine.test.ts`
- `server/tests/games/bottleEngine.test.ts`
- `server/tests/multiGameHandlers.test.ts` — 多局/各游戏集成

### 前端新建
- `brain-train/src/components/versus/VersusStroopBoard.tsx`
- `brain-train/src/components/versus/VersusSequenceBoard.tsx`
- `brain-train/src/components/versus/VersusBottleBoard.tsx`
- `brain-train/src/components/versus/CreateRoomModal.tsx` — 单局/多局 + 游戏选择
- `brain-train/src/components/versus/RoundResultDialog.tsx` — 本轮总结算

### 前端修改
- `brain-train/src/types/versus.ts` — GameMode/GameStartPayload/GameProgressPayload 扩展为联合类型 + roundInfo
- `brain-train/src/stores/versusRoomStore.ts` — gameData/progress 通用化 + roundInfo + 新 view/reducer
- `brain-train/src/lib/versusSocketSession.ts` — game:action + room:nextRound + room:roundEnd + game:grace 监听
- `brain-train/src/pages/Versus.tsx` — 用 CreateRoomModal，传 roundMode/games
- `brain-train/src/pages/VersusRoom.tsx` — 棋盘分派 + 多局 UI + reconfigure
- `brain-train/src/components/versus/VersusResultDialog.tsx` — 通用化（按 mode 显示指标）
- `brain-train/src/components/versus/PlayerProgress.tsx` — 用 percent 替代 found/target
- `brain-train/src/components/versus/index.ts` — 导出新组件

---

## Task 1: 后端 GameMode + Room 类型扩展

**Files:**
- Modify: `server/src/types/room.ts`
- Test: `server/tests/roomHelpers.test.ts`（已有，验证不回归）

**Interfaces:**
- Produces: `GameMode = 'schulte' | 'stroop' | 'sequence' | 'bottle'`；`RoundMode`；扩展后的 `Room`、`RoomCreateInput`、`RoomStatePayload`、`PublicRoom`；新类型 `RoundGameResult`、`RoomReconfigureInput`、`GameStartPayload`（通用）、`GameActionPayload`、`GameProgressPayload`（通用）、`NextRoundPayload`、`RoundEndPayload`、`GracePayload`。

- [ ] **Step 1: 扩展 room.ts 类型**

打开 `server/src/types/room.ts`，做以下修改（保留所有现有不冲突的类型）：

把 `GameMode` 从单字面量改为四选一：
```typescript
export type GameMode = 'schulte' | 'stroop' | 'sequence' | 'bottle';
```

新增 `RoundMode` 和 `RoundGameResult`：
```typescript
export type RoundMode = 'single' | 'multi';

export interface RoundGameResult {
  gameMode: GameMode;
  queueIndex: number;
  results: { playerId: string; won: boolean; accuracy: number; timeMs: number }[];
}
```

扩展 `Room` 接口，在现有字段后加 5 个新字段：
```typescript
export interface Room {
  roomId: string;
  name: string;
  hostId: string;
  state: RoomState;
  gameMode: GameMode;
  maxPlayers: number;
  players: Player[];
  createdAt: number;
  // ===== 新增：本轮多局编排 =====
  roundMode: RoundMode;
  gameQueue: GameMode[];
  currentQueueIndex: number;
  roundResults: RoundGameResult[];
  hostCanChangeGames: boolean;
}
```

扩展 `RoomCreateInput`：
```typescript
export interface RoomCreateInput {
  name?: string;
  roundMode: RoundMode;
  games: GameMode[];
}
```

新增 `RoomReconfigureInput`：
```typescript
export interface RoomReconfigureInput {
  roundMode: RoundMode;
  games: GameMode[];
}
```

扩展 `RoomStatePayload` 和 `PublicRoom`（加本轮信息）：
```typescript
export interface RoomStatePayload {
  roomId: string;
  name: string;
  state: RoomState;
  players: Player[];
  gameMode: GameMode;
  roundMode: RoundMode;
  gameQueue: GameMode[];
  currentQueueIndex: number;
  totalInRound: number;
  hostCanChangeGames: boolean;
}

export interface PublicRoom {
  roomId: string;
  name: string;
  hostName: string;
  playerCount: number;
  gameMode: GameMode;
  state: 'waiting' | 'ready';
  roundMode: RoundMode;
  totalInRound: number;
}
```

新增通用游戏事件 payload 类型（在文件末尾追加）：
```typescript
// 通用 game:start（seed 结构由 GameEngine 定义，这里用 unknown 占位，引擎模块自带类型）
export interface GameStartPayload {
  mode: GameMode;
  seed: unknown;            // 各引擎的 GameSeed 联合类型，见 server/src/games/types.ts
  startTime: number;
  timeLimitMs: number;
  queueIndex: number;
  totalInRound: number;
}

// C→S: game:action（按 mode 区分的动作）
export interface GameActionInput {
  mode: GameMode;
  payload: unknown;         // 各引擎的 GameAction 子类型
}

// 通用 game:progress（归一化百分比）
export interface GameProgressPayload {
  mode: GameMode;
  me: { percent: number; done: boolean };
  opponent: { percent: number; done: boolean };
}

// S→C: room:nextRound（多局推进）
export interface NextRoundPayload {
  nextMode: GameMode;
  queueIndex: number;
  totalInRound: number;
  roundResults: RoundGameResult[];
}

// S→C: room:roundEnd（本轮全部结束）
export interface RoundEndPayload {
  roundResults: RoundGameResult[];
}

// S→C: game:grace（字色先完成者触发对方宽限倒计时）
export interface GracePayload {
  seconds: number;
}
```

- [ ] **Step 2: 验证类型编译通过**

Run: `cd server && npx tsc --noEmit`
Expected: 编译通过（可能有「新字段未在实现处赋值」的暗示性错误，但 tsc 对 interface 扩展不报错；如果有报错是因为 Room 字面量创建处缺新字段——这些在后续 Task 补）。

注意：如果 tsc 报错来自 `roomStore.ts` 的 `create` 函数（因为它构造 Room 对象时没赋新字段），先不修——Task 5 会改 roomStore。此步只需确认 **类型定义本身** 没有语法/重复声明错误。

- [ ] **Step 3: Commit**

```bash
git add server/src/types/room.ts
git commit -m "feat(versus): 扩展后端类型——GameMode 四游戏 + Room 本轮编排字段"
```

---

## Task 2: 后端 GameEngine 接口 + 游戏状态

**Files:**
- Create: `server/src/games/types.ts`
- Create: `server/src/games/gameState.ts`

**Interfaces:**
- Produces: `GameEngine`、`GameSeed`、`PlayerProgress`（联合）、`GameAction`（联合）、`FinalizedProgress`；`VersusGame`（通用对局状态）、`createGameState()`。

- [ ] **Step 1: 写 GameEngine 接口和联合类型**

创建 `server/src/games/types.ts`：
```typescript
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
```

- [ ] **Step 2: 写通用对局状态 store**

创建 `server/src/games/gameState.ts`：
```typescript
// 通用对局状态（取代 schulte 专属的 RoomGame）。每局开始创建，结束删除。
import type { GameMode } from '../types/room.js';
import type { GameSeed, PlayerProgress } from './types.js';

export interface VersusGame {
  roomId: string;
  mode: GameMode;
  seed: GameSeed;
  startTime: number;
  timeLimitMs: number;
  players: Map<string, PlayerProgress>;
  ended: boolean;
  // 字色宽限倒计时状态
  graceTimerStarted: boolean;
}

const games = new Map<string, VersusGame>();

export const gameState = {
  create(g: Omit<VersusGame, 'ended' | 'graceTimerStarted'>): VersusGame {
    const game: VersusGame = { ...g, ended: false, graceTimerStarted: false };
    games.set(g.roomId, game);
    return game;
  },
  get(roomId: string): VersusGame | undefined {
    return games.get(roomId);
  },
  updateProgress(roomId: string, playerId: string, progress: PlayerProgress): boolean {
    const g = games.get(roomId);
    if (!g) return false;
    g.players.set(playerId, progress);
    return true;
  },
  markEnded(roomId: string): void {
    const g = games.get(roomId);
    if (g) g.ended = true;
  },
  remove(roomId: string): void {
    games.delete(roomId);
  },
};
```

- [ ] **Step 3: 验证编译**

Run: `cd server && npx tsc --noEmit`
Expected: 通过（新文件自洽，未引用未定义符号）。

- [ ] **Step 4: Commit**

```bash
git add server/src/games/types.ts server/src/games/gameState.ts
git commit -m "feat(versus): GameEngine 接口 + 通用对局状态 store"
```

---

## Task 3: 舒尔特引擎（迁移 + direction）

**Files:**
- Create: `server/src/games/schulteEngine.ts`
- Create: `server/tests/games/schulteEngine.test.ts`

**Interfaces:**
- Consumes: `GameEngine` from `server/src/games/types.ts`
- Produces: `schulteEngine: GameEngine`（mode='schulte'）

- [ ] **Step 1: 写失败测试**

创建 `server/tests/games/schulteEngine.test.ts`：
```typescript
import { describe, it, expect } from 'vitest';
import { schulteEngine } from '../../src/games/schulteEngine.js';

describe('schulteEngine', () => {
  it('generateSeed 生成 25 格表 + 合法 direction + order', () => {
    const seed = schulteEngine.generateSeed();
    if (seed.mode !== 'schulte') throw new Error('mode 应为 schulte');
    expect(seed.grid).toHaveLength(25);
    expect(seed.target).toBe(25);
    expect(seed.size).toBe(5);
    expect(['forward', 'reverse', 'random']).toContain(seed.direction);
    expect(seed.order).toHaveLength(25);
    // order 是 1..25 的某种排列
    const sorted = [...seed.order].sort((a, b) => a - b);
    expect(sorted).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });

  it('createProgress 初始化为 0', () => {
    const p = schulteEngine.createProgress();
    if (p.mode !== 'schulte') throw new Error('mode 不对');
    expect(p.found).toBe(0);
    expect(p.errors).toBe(0);
    expect(p.done).toBe(false);
  });

  it('applyAction 正序点对 → found+1', () => {
    const seed = schulteEngine.generateSeed();
    if (seed.mode !== 'schulte') throw new Error();
    const p = schulteEngine.createProgress();
    // order[0] 是第一个该点的数，找它在 grid 里的位置
    const firstTarget = seed.order[0];
    const cellIndex = seed.grid.indexOf(firstTarget);
    const { progress, finished } = schulteEngine.applyAction(p, { mode: 'schulte', cellIndex }, seed, 0, 1000);
    if (progress.mode !== 'schulte') throw new Error();
    expect(progress.found).toBe(1);
    expect(progress.errors).toBe(0);
    expect(finished).toBe(false);
  });

  it('applyAction 点错 → errors+1', () => {
    const seed = schulteEngine.generateSeed();
    if (seed.mode !== 'schulte') throw new Error();
    const p = schulteEngine.createProgress();
    // 故意点 order 的第二个（不是第一个）
    const wrongTarget = seed.order[1];
    const cellIndex = seed.grid.indexOf(wrongTarget);
    const { progress } = schulteEngine.applyAction(p, { mode: 'schulte', cellIndex }, seed, 0, 1000);
    if (progress.mode !== 'schulte') throw new Error();
    expect(progress.found).toBe(0);
    expect(progress.errors).toBe(1);
  });

  it('点完 25 个 → done + finished', () => {
    const seed = schulteEngine.generateSeed();
    if (seed.mode !== 'schulte') throw new Error();
    let p = schulteEngine.createProgress();
    let finished = false;
    for (let i = 0; i < 25; i++) {
      const target = seed.order[i];
      const cellIndex = seed.grid.indexOf(target);
      const r = schulteEngine.applyAction(p, { mode: 'schulte', cellIndex }, seed, 0, 1000 + i);
      p = r.progress;
      finished = r.finished;
    }
    if (p.mode !== 'schulte') throw new Error();
    expect(p.done).toBe(true);
    expect(p.found).toBe(25);
    expect(finished).toBe(true);
  });

  it('finalize 点完的用 finishTime，没点完补齐 errors', () => {
    const seed = schulteEngine.generateSeed();
    if (seed.mode !== 'schulte') throw new Error();
    // 点了 10 个
    let p = schulteEngine.createProgress();
    for (let i = 0; i < 10; i++) {
      const cellIndex = seed.grid.indexOf(seed.order[i]);
      p = schulteEngine.applyAction(p, { mode: 'schulte', cellIndex }, seed, 0, 1000 + i).progress;
    }
    const final = schulteEngine.finalize(p, seed, 0, 50000);
    expect(final.done).toBe(false);
    if (p.mode !== 'schulte') throw new Error();
    // detail.errors 应含补齐的 15
    expect(final.detail.errors).toBe(15);
    expect(final.timeMs).toBe(50000);
  });

  it('computePercent 单调递增', () => {
    const seed = schulteEngine.generateSeed();
    if (seed.mode !== 'schulte') throw new Error();
    let p = schulteEngine.createProgress();
    expect(schulteEngine.computePercent(p, seed)).toBe(0);
    for (let i = 0; i < 25; i++) {
      const cellIndex = seed.grid.indexOf(seed.order[i]);
      p = schulteEngine.applyAction(p, { mode: 'schulte', cellIndex }, seed, 0, 1000 + i).progress;
      const pct = schulteEngine.computePercent(p, seed);
      expect(pct).toBe(Math.round(((i + 1) / 25) * 100));
    }
  });

  it('shouldEndWhenAnyDone = true（race）', () => {
    expect(schulteEngine.shouldEndWhenAnyDone).toBe(true);
  });

  it('direction=forward 时 order 是 1..25', () => {
    // 多次生成直到拿到 forward，验证 order
    for (let attempt = 0; attempt < 50; attempt++) {
      const seed = schulteEngine.generateSeed();
      if (seed.mode === 'schulte' && seed.direction === 'forward') {
        expect(seed.order).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
        return;
      }
    }
    throw new Error('50 次都没生成 forward');
  });

  it('direction=reverse 时 order 是 25..1', () => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const seed = schulteEngine.generateSeed();
      if (seed.mode === 'schulte' && seed.direction === 'reverse') {
        expect(seed.order).toEqual(Array.from({ length: 25 }, (_, i) => 25 - i));
        return;
      }
    }
    throw new Error('50 次都没生成 reverse');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd server && npx vitest run tests/games/schulteEngine.test.ts`
Expected: FAIL — `Cannot find module '../../src/games/schulteEngine.js'`

- [ ] **Step 3: 实现 schulteEngine**

创建 `server/src/games/schulteEngine.ts`：
```typescript
// 舒尔特对战引擎：迁移自 src/schulte/schulteGame.ts + 新增 direction。
import type { GameEngine, GameSeed, PlayerProgress, GameAction, FinalizedProgress } from './types.js';

const GRID_SIZE = 5;
const TIME_LIMIT_MS = 90000;

type SchulteProgress = Extract<PlayerProgress, { mode: 'schulte' }>;
type SchulteSeed = Extract<GameSeed, { mode: 'schulte' }>;
type SchulteAction = Extract<GameAction, { mode: 'schulte' }>;

// Fisher-Yates 洗牌
function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function generateGrid(size: number): number[] {
  const n = size * size;
  return shuffle(Array.from({ length: n }, (_, i) => i + 1));
}

// 按 direction 算「要点顺序」
function buildOrder(direction: 'forward' | 'reverse' | 'random', target: number): number[] {
  if (direction === 'forward') return Array.from({ length: target }, (_, i) => i + 1);
  if (direction === 'reverse') return Array.from({ length: target }, (_, i) => target - i);
  // random：1..target 的随机排列
  return shuffle(Array.from({ length: target }, (_, i) => i + 1));
}

export const schulteEngine: GameEngine = {
  mode: 'schulte',
  timeLimitMs: TIME_LIMIT_MS,
  shouldEndWhenAnyDone: true,

  generateSeed(): SchulteSeed {
    const grid = generateGrid(GRID_SIZE);
    const target = grid.length;
    const directions = ['forward', 'reverse', 'random'] as const;
    const direction = directions[Math.floor(Math.random() * directions.length)];
    const order = buildOrder(direction, target);
    return { mode: 'schulte', grid, size: GRID_SIZE, target, direction, order };
  },

  createProgress(): SchulteProgress {
    return { mode: 'schulte', found: 0, errors: 0, done: false, finishTime: null };
  },

  applyAction(progress: PlayerProgress, action: GameAction, seed: GameSeed, _startTime: number, now: number) {
    if (progress.mode !== 'schulte' || action.mode !== 'schulte' || seed.mode !== 'schulte') {
      return { progress, finished: false };
    }
    if (progress.done) return { progress, finished: false };
    const expected = seed.order[progress.found]; // 当前该点的数
    if (action.cellIndex < 0 || action.cellIndex >= seed.grid.length) {
      return { progress: { ...progress, errors: progress.errors + 1 }, finished: false };
    }
    const tapped = seed.grid[action.cellIndex];
    if (tapped === expected) {
      const newFound = progress.found + 1;
      const done = newFound === seed.target;
      return {
        progress: { ...progress, found: newFound, done, finishTime: done ? now : null },
        finished: done,
      };
    }
    return { progress: { ...progress, errors: progress.errors + 1 }, finished: false };
  },

  finalize(progress: PlayerProgress, seed: GameSeed, startTime: number, endTime: number): FinalizedProgress {
    if (progress.mode !== 'schulte' || seed.mode !== 'schulte') {
      return { accuracy: 0, timeMs: 0, done: false, detail: {} };
    }
    const unfilled = progress.done ? 0 : (seed.target - progress.found);
    const finalErrors = progress.errors + unfilled;
    const timeMs = progress.done && progress.finishTime !== null
      ? progress.finishTime - startTime
      : endTime - startTime;
    const denom = progress.found + finalErrors;
    const accuracy = denom === 0 ? 0 : progress.found / denom;
    return {
      accuracy,
      timeMs,
      done: progress.done,
      detail: { found: progress.found, errors: finalErrors },
    };
  },

  computePercent(progress: PlayerProgress, seed: GameSeed): number {
    if (progress.mode !== 'schulte' || seed.mode !== 'schulte') return 0;
    return Math.round((progress.found / seed.target) * 100);
  },
};
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd server && npx vitest run tests/games/schulteEngine.test.ts`
Expected: PASS（全部用例）

- [ ] **Step 5: Commit**

```bash
git add server/src/games/schulteEngine.ts server/tests/games/schulteEngine.test.ts
git commit -m "feat(versus): 舒尔特引擎（迁移 + direction 三选一随机）"
```

---

## Task 4: 字色引擎

**Files:**
- Create: `server/src/games/stroopEngine.ts`
- Create: `server/tests/games/stroopEngine.test.ts`

**Interfaces:**
- Produces: `stroopEngine: GameEngine`（mode='stroop'，10 题，每题 8s，宽限 10s，总 120s）

- [ ] **Step 1: 写失败测试**

创建 `server/tests/games/stroopEngine.test.ts`：
```typescript
import { describe, it, expect } from 'vitest';
import { stroopEngine, STROOP_COLORS } from '../../src/games/stroopEngine.js';

describe('stroopEngine', () => {
  it('STROOP_COLORS 有 6 个颜色', () => {
    expect(STROOP_COLORS).toHaveLength(6);
    expect(STROOP_COLORS.map((c) => c.name)).toEqual(['红色', '蓝色', '绿色', '黄色', '紫色', '橙色']);
  });

  it('generateSeed 生成 10 题，每题合法', () => {
    const seed = stroopEngine.generateSeed();
    if (seed.mode !== 'stroop') throw new Error('mode 应为 stroop');
    expect(seed.questions).toHaveLength(10);
    expect(seed.timePerQuestionSec).toBe(8);
    expect(seed.finishGraceSec).toBe(10);
    for (const q of seed.questions) {
      // word 和 wordColor 都是合法颜色名
      expect(STROOP_COLORS.some((c) => c.name === q.word)).toBe(true);
      expect(STROOP_COLORS.some((c) => c.name === q.wordColor)).toBe(true);
      // correctAnswer 符合 rule
      if (q.rule === 'standard') expect(q.correctAnswer).toBe(q.wordColor);
      else expect(q.correctAnswer).toBe(q.word);
    }
  });

  it('createProgress 初始化', () => {
    const p = stroopEngine.createProgress();
    if (p.mode !== 'stroop') throw new Error();
    expect(p.answered).toBe(0);
    expect(p.correct).toBe(0);
    expect(p.done).toBe(false);
  });

  it('applyAction 答对 → correct+1，答错 → errors+1', () => {
    const seed = stroopEngine.generateSeed();
    if (seed.mode !== 'stroop') throw new Error();
    const p = stroopEngine.createProgress();
    // 答对第一题
    const r1 = stroopEngine.applyAction(p, { mode: 'stroop', questionIndex: 0, answer: seed.questions[0].correctAnswer }, seed, 0, 1000);
    if (r1.progress.mode !== 'stroop') throw new Error();
    expect(r1.progress.answered).toBe(1);
    expect(r1.progress.correct).toBe(1);
    expect(r1.progress.errors).toBe(0);
    // 答错第二题（给个错误答案）
    const wrongAns = seed.questions[1].correctAnswer === '红色' ? '蓝色' : '红色';
    const r2 = stroopEngine.applyAction(r1.progress, { mode: 'stroop', questionIndex: 1, answer: wrongAns }, seed, 0, 2000);
    if (r2.progress.mode !== 'stroop') throw new Error();
    expect(r2.progress.answered).toBe(2);
    expect(r2.progress.correct).toBe(1);
    expect(r2.progress.errors).toBe(1);
  });

  it('答完 10 题 → done + finished', () => {
    const seed = stroopEngine.generateSeed();
    if (seed.mode !== 'stroop') throw new Error();
    let p = stroopEngine.createProgress();
    let finished = false;
    for (let i = 0; i < 10; i++) {
      const r = stroopEngine.applyAction(p, { mode: 'stroop', questionIndex: i, answer: seed.questions[i].correctAnswer }, seed, 0, 1000 + i * 100);
      p = r.progress;
      finished = r.finished;
    }
    if (p.mode !== 'stroop') throw new Error();
    expect(p.answered).toBe(10);
    expect(p.done).toBe(true);
    expect(finished).toBe(true);
  });

  it('finalize 正确率 = correct / 10', () => {
    const seed = stroopEngine.generateSeed();
    if (seed.mode !== 'stroop') throw new Error();
    let p = stroopEngine.createProgress();
    // 答对 7 题、错 3 题
    for (let i = 0; i < 10; i++) {
      const ans = i < 7 ? seed.questions[i].correctAnswer : '不存在';
      p = stroopEngine.applyAction(p, { mode: 'stroop', questionIndex: i, answer: ans }, seed, 0, 1000 + i * 100).progress;
    }
    const final = stroopEngine.finalize(p, seed, 0, 60000);
    expect(final.accuracy).toBe(0.7);
    expect(final.done).toBe(true);
    expect(final.detail.correct).toBe(7);
    expect(final.detail.errors).toBe(3);
  });

  it('computePercent = answered / 10 * 100', () => {
    const seed = stroopEngine.generateSeed();
    if (seed.mode !== 'stroop') throw new Error();
    let p = stroopEngine.createProgress();
    expect(stroopEngine.computePercent(p, seed)).toBe(0);
    for (let i = 0; i < 5; i++) {
      p = stroopEngine.applyAction(p, { mode: 'stroop', questionIndex: i, answer: seed.questions[i].correctAnswer }, seed, 0, 1000).progress;
    }
    expect(stroopEngine.computePercent(p, seed)).toBe(50);
  });

  it('shouldEndWhenAnyDone = false（用宽限机制）', () => {
    expect(stroopEngine.shouldEndWhenAnyDone).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd server && npx vitest run tests/games/stroopEngine.test.ts`
Expected: FAIL — `Cannot find module`

- [ ] **Step 3: 实现 stroopEngine**

创建 `server/src/games/stroopEngine.ts`：
```typescript
// 字色对战引擎。题目服务端生成（70% 干扰 / 30% 一致），每题 rule 三选一随机。
import type { GameEngine, GameSeed, PlayerProgress, GameAction, FinalizedProgress, StroopQuestionDef } from './types.js';

const QUESTION_COUNT = 10;
const TIME_PER_QUESTION_SEC = 8;
const FINISH_GRACE_SEC = 10;
const TIME_LIMIT_MS = 120000;  // 整体上限兜底

export interface StroopColor { name: string; value: string; }

// 6 色（与前端 StroopGame.tsx COLORS 一致，只保留 name + value）
export const STROOP_COLORS: StroopColor[] = [
  { name: '红色', value: '#ef4444' },
  { name: '蓝色', value: '#3b82f6' },
  { name: '绿色', value: '#22c55e' },
  { name: '黄色', value: '#eab308' },
  { name: '紫色', value: '#a855f7' },
  { name: '橙色', value: '#f97316' },
];

function randomColor(): StroopColor {
  return STROOP_COLORS[Math.floor(Math.random() * STROOP_COLORS.length)];
}

// 生成单题：70% 概率干扰（word≠wordColor），30% 一致
function generateQuestion(): StroopQuestionDef {
  const rule: 'standard' | 'reverse' = Math.random() < 0.5 ? 'standard' : 'reverse';
  const wordColor = randomColor();
  let displayColor = randomColor();
  if (Math.random() < 0.7) {
    while (displayColor.name === wordColor.name) displayColor = randomColor();
  } else {
    displayColor = wordColor;
  }
  // word = 字面含义（wordColor.name），wordColor = 实际显示颜色（displayColor.name）
  const correctAnswer = rule === 'standard' ? displayColor.name : wordColor.name;
  return { word: wordColor.name, wordColor: displayColor.name, correctAnswer, rule };
}

type StroopProgress = Extract<PlayerProgress, { mode: 'stroop' }>;
type StroopSeed = Extract<GameSeed, { mode: 'stroop' }>;

export const stroopEngine: GameEngine = {
  mode: 'stroop',
  timeLimitMs: TIME_LIMIT_MS,
  shouldEndWhenAnyDone: false,

  generateSeed(): StroopSeed {
    const questions = Array.from({ length: QUESTION_COUNT }, () => generateQuestion());
    return { mode: 'stroop', questions, timePerQuestionSec: TIME_PER_QUESTION_SEC, finishGraceSec: FINISH_GRACE_SEC };
  },

  createProgress(): StroopProgress {
    return { mode: 'stroop', answered: 0, correct: 0, errors: 0, done: false, finishTime: null };
  },

  applyAction(progress: PlayerProgress, action: GameAction, seed: GameSeed, _startTime: number, now: number) {
    if (progress.mode !== 'stroop' || action.mode !== 'stroop' || seed.mode !== 'stroop') {
      return { progress, finished: false };
    }
    if (progress.done) return { progress, finished: false };
    const q = seed.questions[action.questionIndex];
    if (!q) return { progress, finished: false };
    const isCorrect = action.answer === q.correctAnswer;
    const newAnswered = progress.answered + 1;
    const done = newAnswered >= seed.questions.length;
    return {
      progress: {
        ...progress,
        answered: newAnswered,
        correct: progress.correct + (isCorrect ? 1 : 0),
        errors: progress.errors + (isCorrect ? 0 : 1),
        done,
        finishTime: done ? now : null,
      },
      finished: done,
    };
  },

  finalize(progress: PlayerProgress, _seed: GameSeed, startTime: number, endTime: number): FinalizedProgress {
    if (progress.mode !== 'stroop') return { accuracy: 0, timeMs: 0, done: false, detail: {} };
    const timeMs = progress.done && progress.finishTime !== null
      ? progress.finishTime - startTime
      : endTime - startTime;
    const accuracy = progress.answered === 0 ? 0 : progress.correct / QUESTION_COUNT;
    return {
      accuracy,
      timeMs,
      done: progress.done,
      detail: { answered: progress.answered, correct: progress.correct, errors: progress.errors },
    };
  },

  computePercent(progress: PlayerProgress, _seed: GameSeed): number {
    if (progress.mode !== 'stroop') return 0;
    return Math.round((progress.answered / QUESTION_COUNT) * 100);
  },
};
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd server && npx vitest run tests/games/stroopEngine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/games/stroopEngine.ts server/tests/games/stroopEngine.test.ts
git commit -m "feat(versus): 字色引擎（10 题 + 每题 rule 随机 + 70% 干扰）"
```

---

## Task 5: 序列记忆引擎

**Files:**
- Create: `server/src/games/sequenceEngine.ts`
- Create: `server/tests/games/sequenceEngine.test.ts`

**Interfaces:**
- Produces: `sequenceEngine: GameEngine`（mode='sequence'，长度 6，回忆 15s，含干扰）

- [ ] **Step 1: 写失败测试**

创建 `server/tests/games/sequenceEngine.test.ts`：
```typescript
import { describe, it, expect } from 'vitest';
import { sequenceEngine, SEQUENCE_ITEMS_POOL } from '../../src/games/sequenceEngine.js';

describe('sequenceEngine', () => {
  it('SEQUENCE_ITEM_POOL 有 12 个 emoji', () => {
    expect(SEQUENCE_ITEM_POOL).toHaveLength(12);
  });

  it('generateSeed 生成 6 元序列 + 干扰 + optionPool', () => {
    const seed = sequenceEngine.generateSeed();
    if (seed.mode !== 'sequence') throw new Error('mode 应为 sequence');
    expect(seed.sequence).toHaveLength(6);
    expect(seed.sequence.length).toBe(new Set(seed.sequence).size); // 无重复
    expect(seed.distractors.length).toBeGreaterThan(0);
    expect(seed.optionPool).toHaveLength(seed.sequence.length + seed.distractors.length);
    expect(seed.memorizeMs).toBe(4000);
    expect(seed.recallTimeLimitMs).toBe(15000);
  });

  it('createProgress 初始化', () => {
    const p = sequenceEngine.createProgress();
    if (p.mode !== 'sequence') throw new Error();
    expect(p.submitted).toBe(false);
    expect(p.userSequence).toEqual([]);
    expect(p.positionCorrect).toBe(0);
  });

  it('applyAction 提交全对 → positionCorrect=6, finished', () => {
    const seed = sequenceEngine.generateSeed();
    if (seed.mode !== 'sequence') throw new Error();
    const p = sequenceEngine.createProgress();
    const r = sequenceEngine.applyAction(p, { mode: 'sequence', userSequence: seed.sequence }, seed, 0, 5000);
    if (r.progress.mode !== 'sequence') throw new Error();
    expect(r.progress.submitted).toBe(true);
    expect(r.progress.positionCorrect).toBe(6);
    expect(r.finished).toBe(true);
  });

  it('applyAction 提交部分对 → positionCorrect 正确计数', () => {
    const seed = sequenceEngine.generateSeed();
    if (seed.mode !== 'sequence') throw new Error();
    const p = sequenceEngine.createProgress();
    // 只把第 0、2 位放对（共 2 对）
    const wrong = SEQUENCE_ITEM_POOL.find((e) => !seed.sequence.includes(e))!;
    const submitted = [seed.sequence[0], wrong, seed.sequence[2], wrong, wrong, wrong];
    const r = sequenceEngine.applyAction(p, { mode: 'sequence', userSequence: submitted }, seed, 0, 8000);
    if (r.progress.mode !== 'sequence') throw new Error();
    expect(r.progress.positionCorrect).toBe(2);
    expect(r.progress.submitted).toBe(true);
    expect(r.finished).toBe(true);
  });

  it('已提交再提交 → 不变', () => {
    const seed = sequenceEngine.generateSeed();
    if (seed.mode !== 'sequence') throw new Error();
    let p = sequenceEngine.createProgress();
    p = sequenceEngine.applyAction(p, { mode: 'sequence', userSequence: seed.sequence }, seed, 0, 5000).progress;
    const r = sequenceEngine.applyAction(p, { mode: 'sequence', userSequence: ['x', 'x', 'x', 'x', 'x', 'x'] }, seed, 0, 6000);
    // submitted 已 true，不变
    if (r.progress.mode !== 'sequence') throw new Error();
    expect(r.progress.positionCorrect).toBe(6);
  });

  it('finalize accuracy = positionCorrect / 6', () => {
    const seed = sequenceEngine.generateSeed();
    if (seed.mode !== 'sequence') throw new Error();
    const p = sequenceEngine.createProgress();
    const wrong = SEQUENCE_ITEM_POOL.find((e) => !seed.sequence.includes(e))!;
    const submitted = [seed.sequence[0], wrong, wrong, wrong, wrong, wrong]; // 1 对
    const prog = sequenceEngine.applyAction(p, { mode: 'sequence', userSequence: submitted }, seed, 0, 8000).progress;
    const final = sequenceEngine.finalize(prog, seed, 0, 15000);
    expect(final.accuracy).toBeCloseTo(1 / 6, 5);
    expect(final.done).toBe(true);
    expect(final.detail.positionCorrect).toBe(1);
  });

  it('finalize 未提交（超时）→ done=false, accuracy 按 0', () => {
    const seed = sequenceEngine.generateSeed();
    if (seed.mode !== 'sequence') throw new Error();
    const p = sequenceEngine.createProgress();
    const final = sequenceEngine.finalize(p, seed, 0, 15000);
    expect(final.done).toBe(false);
    expect(final.accuracy).toBe(0);
  });

  it('computePercent 提交后=100，未提交=0', () => {
    const seed = sequenceEngine.generateSeed();
    if (seed.mode !== 'sequence') throw new Error();
    const p0 = sequenceEngine.createProgress();
    expect(sequenceEngine.computePercent(p0, seed)).toBe(0);
    const p1 = sequenceEngine.applyAction(p0, { mode: 'sequence', userSequence: seed.sequence }, seed, 0, 5000).progress;
    expect(sequenceEngine.computePercent(p1, seed)).toBe(100);
  });

  it('shouldEndWhenAnyDone = false（双方都提交才结算）', () => {
    expect(sequenceEngine.shouldEndWhenAnyDone).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd server && npx vitest run tests/games/sequenceEngine.test.ts`
Expected: FAIL — `Cannot find module`

- [ ] **Step 3: 实现 sequenceEngine**

创建 `server/src/games/sequenceEngine.ts`：
```typescript
// 序列记忆对战引擎。序列长度 6，回忆限时 15s，回忆阶段含干扰项。
import type { GameEngine, GameSeed, PlayerProgress, GameAction, FinalizedProgress } from './types.js';

const SEQUENCE_LENGTH = 6;
const MEMORIZE_MS = 4000;
const RECALL_TIME_LIMIT_MS = 15000;
const TIME_LIMIT_MS = MEMORIZE_MS + RECALL_TIME_LIMIT_MS;  // 总上限兜底（含 memorize）

// 12 emoji 物品池（与前端 SequenceGame.tsx ITEMS_POOL 一致）
export const SEQUENCE_ITEM_POOL = [
  '🐶', '🐱', '🐰', '🦊', '🐸', '🐧',
  '🍎', '🍋', '🍇', '🫐', '🍑', '🐝',
];

function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type SequenceProgress = Extract<PlayerProgress, { mode: 'sequence' }>;
type SequenceSeed = Extract<GameSeed, { mode: 'sequence' }>;

export const sequenceEngine: GameEngine = {
  mode: 'sequence',
  timeLimitMs: TIME_LIMIT_MS,
  shouldEndWhenAnyDone: false,

  generateSeed(): SequenceSeed {
    const shuffled = shuffle(SEQUENCE_ITEM_POOL);
    const sequence = shuffled.slice(0, SEQUENCE_LENGTH);
    // 干扰项：池里剩下的随机取 3 个
    const distractors = shuffle(shuffled.slice(SEQUENCE_LENGTH)).slice(0, 3);
    const optionPool = shuffle([...sequence, ...distractors]);
    return { mode: 'sequence', sequence, distractors, optionPool, memorizeMs: MEMORIZE_MS, recallTimeLimitMs: RECALL_TIME_LIMIT_MS };
  },

  createProgress(): SequenceProgress {
    return { mode: 'sequence', submitted: false, userSequence: [], positionCorrect: 0, submitTime: null };
  },

  applyAction(progress: PlayerProgress, action: GameAction, seed: GameSeed, _startTime: number, now: number) {
    if (progress.mode !== 'sequence' || action.mode !== 'sequence' || seed.mode !== 'sequence') {
      return { progress, finished: false };
    }
    if (progress.submitted) return { progress, finished: false };
    // 数位置准确率
    let positionCorrect = 0;
    for (let i = 0; i < seed.sequence.length; i++) {
      if (action.userSequence[i] === seed.sequence[i]) positionCorrect++;
    }
    return {
      progress: {
        ...progress,
        submitted: true,
        userSequence: action.userSequence,
        positionCorrect,
        submitTime: now,
      },
      finished: true,  // 提交即该方完成（但 shouldEndWhenAnyDone=false，要等双方）
    };
  },

  finalize(progress: PlayerProgress, seed: GameSeed, startTime: number, endTime: number): FinalizedProgress {
    if (progress.mode !== 'sequence' || seed.mode !== 'sequence') {
      return { accuracy: 0, timeMs: 0, done: false, detail: {} };
    }
    if (!progress.submitted) {
      // 未提交（超时）：accuracy=0，时间用回忆阶段上限
      return { accuracy: 0, timeMs: RECALL_TIME_LIMIT_MS, done: false, detail: { positionCorrect: 0 } };
    }
    // 回忆用时 = submitTime - recall开始时刻。recall 开始于 startTime + memorizeMs。
    const recallStart = startTime + seed.memorizeMs;
    const timeMs = (progress.submitTime ?? endTime) - recallStart;
    const accuracy = progress.positionCorrect / seed.sequence.length;
    return {
      accuracy,
      timeMs,
      done: true,
      detail: { positionCorrect: progress.positionCorrect, userSequence: progress.userSequence },
    };
  },

  computePercent(progress: PlayerProgress, _seed: GameSeed): number {
    if (progress.mode !== 'sequence') return 0;
    // 序列没有「进行中百分比」——未提交=0，提交=100
    return progress.submitted ? 100 : 0;
  },
};
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd server && npx vitest run tests/games/sequenceEngine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/games/sequenceEngine.ts server/tests/games/sequenceEngine.test.ts
git commit -m "feat(versus): 序列记忆引擎（长度 6 + 干扰 + 位置准确率）"
```

---

## Task 6: 暗瓶引擎

**Files:**
- Create: `server/src/games/bottleEngine.ts`
- Create: `server/tests/games/bottleEngine.test.ts`

**Interfaces:**
- Produces: `bottleEngine: GameEngine`（mode='bottle'，6 瓶，180s）

- [ ] **Step 1: 写失败测试**

创建 `server/tests/games/bottleEngine.test.ts`：
```typescript
import { describe, it, expect } from 'vitest';
import { bottleEngine, BOTTLE_COLOR_IDS } from '../../src/games/bottleEngine.js';

describe('bottleEngine', () => {
  it('BOTTLE_COLOR_IDS 有 9 色，前 6 个用于对战', () => {
    expect(BOTTLE_COLOR_IDS).toHaveLength(9);
  });

  it('generateSeed 生成 target + initial，两者不全同，各 6 色', () => {
    const seed = bottleEngine.generateSeed();
    if (seed.mode !== 'bottle') throw new Error('mode 应为 bottle');
    expect(seed.targetSequence).toHaveLength(6);
    expect(seed.initialSequence).toHaveLength(6);
    expect(new Set(seed.targetSequence).size).toBe(6);  // 无重复
    expect(new Set(seed.initialSequence).size).toBe(6);
    // 不全同
    expect(seed.targetSequence).not.toEqual(seed.initialSequence);
  });

  it('createProgress 初始化为 initialSequence', () => {
    const seed = bottleEngine.generateSeed();
    if (seed.mode !== 'bottle') throw new Error();
    const p = bottleEngine.createProgress();
    if (p.mode !== 'bottle') throw new Error();
    expect(p.playerSequence).toEqual([]);
    expect(p.matched).toBe(0);
    expect(p.done).toBe(false);
  });

  it('applyAction 排到 target → done + finished', () => {
    const seed = bottleEngine.generateSeed();
    if (seed.mode !== 'bottle') throw new Error();
    const p = bottleEngine.createProgress();
    const r = bottleEngine.applyAction(p, { mode: 'bottle', playerSequence: seed.targetSequence }, seed, 0, 5000);
    if (r.progress.mode !== 'bottle') throw new Error();
    expect(r.progress.done).toBe(true);
    expect(r.progress.matched).toBe(6);
    expect(r.finished).toBe(true);
  });

  it('applyAction 部分匹配 → matched 计数正确，未完成', () => {
    const seed = bottleEngine.generateSeed();
    if (seed.mode !== 'bottle') throw new Error();
    const p = bottleEngine.createProgress();
    // 把第 0 位放对，其余乱放
    const seq = [...seed.targetSequence];
    [seq[1], seq[2]] = [seq[2], seq[1]];  // 交换 1、2 → 至少 4 个错位
    const r = bottleEngine.applyAction(p, { mode: 'bottle', playerSequence: seq }, seed, 0, 3000);
    if (r.progress.mode !== 'bottle') throw new Error();
    expect(r.progress.done).toBe(false);
    expect(r.progress.matched).toBeGreaterThan(0);
    expect(r.finished).toBe(false);
  });

  it('finalize 排对 → accuracy=1；未排对 → accuracy=matched/6', () => {
    const seed = bottleEngine.generateSeed();
    if (seed.mode !== 'bottle') throw new Error();
    // 排对
    const pDone = bottleEngine.applyAction(bottleEngine.createProgress(), { mode: 'bottle', playerSequence: seed.targetSequence }, seed, 0, 5000).progress;
    const fDone = bottleEngine.finalize(pDone, seed, 0, 5000);
    expect(fDone.accuracy).toBe(1);
    expect(fDone.done).toBe(true);
    // 部分匹配（只对 3 个）
    const partial = [...seed.targetSequence];
    [partial[3], partial[4]] = [partial[4], partial[3]];
    [partial[0], partial[1]] = [partial[1], partial[0]];
    const pPart = bottleEngine.applyAction(bottleEngine.createProgress(), { mode: 'bottle', playerSequence: partial }, seed, 0, 4000).progress;
    const fPart = bottleEngine.finalize(pPart, seed, 0, 60000);
    expect(fPart.done).toBe(false);
    if (pPart.mode !== 'bottle') throw new Error();
    expect(fPart.accuracy).toBeCloseTo(pPart.matched / 6, 5);
  });

  it('computePercent = matched / 6 * 100', () => {
    const seed = bottleEngine.generateSeed();
    if (seed.mode !== 'bottle') throw new Error();
    const partial = [...seed.targetSequence];
    [partial[0], partial[1]] = [partial[1], partial[0]];
    const p = bottleEngine.applyAction(bottleEngine.createProgress(), { mode: 'bottle', playerSequence: partial }, seed, 0, 3000).progress;
    const pct = bottleEngine.computePercent(p, seed);
    if (p.mode !== 'bottle') throw new Error();
    expect(pct).toBe(Math.round((p.matched / 6) * 100));
  });

  it('shouldEndWhenAnyDone = true（race）', () => {
    expect(bottleEngine.shouldEndWhenAnyDone).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd server && npx vitest run tests/games/bottleEngine.test.ts`
Expected: FAIL — `Cannot find module`

- [ ] **Step 3: 实现 bottleEngine**

创建 `server/src/games/bottleEngine.ts`：
```typescript
// 暗瓶对战引擎。6 瓶，目标排列服务端生成，初始排列服务端生成（双方相同），先排对者赢。
import type { GameEngine, GameSeed, PlayerProgress, GameAction, FinalizedProgress } from './types.js';

const BOTTLE_COUNT = 6;
const TIME_LIMIT_MS = 180000;

// 9 色 id（与前端 BottleGame.tsx BOTTLE_COLORS 一致）
export const BOTTLE_COLOR_IDS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'cyan', 'pink', 'brown'];

function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// 数位置匹配数
function countMatches(target: string[], player: string[]): number {
  let m = 0;
  for (let i = 0; i < target.length; i++) {
    if (player[i] === target[i]) m++;
  }
  return m;
}

type BottleProgress = Extract<PlayerProgress, { mode: 'bottle' }>;
type BottleSeed = Extract<GameSeed, { mode: 'bottle' }>;

export const bottleEngine: GameEngine = {
  mode: 'bottle',
  timeLimitMs: TIME_LIMIT_MS,
  shouldEndWhenAnyDone: true,

  generateSeed(): BottleSeed {
    const colors = BOTTLE_COLOR_IDS.slice(0, BOTTLE_COUNT);
    const targetSequence = shuffle(colors);
    let initialSequence = shuffle(colors);
    // 保证不全同（至少错一位）
    while (countMatches(targetSequence, initialSequence) === BOTTLE_COUNT) {
      initialSequence = shuffle(colors);
    }
    return { mode: 'bottle', targetSequence, initialSequence };
  },

  createProgress(): BottleProgress {
    return { mode: 'bottle', playerSequence: [], matched: 0, done: false, finishTime: null };
  },

  applyAction(progress: PlayerProgress, action: GameAction, seed: GameSeed, _startTime: number, now: number) {
    if (progress.mode !== 'bottle' || action.mode !== 'bottle' || seed.mode !== 'bottle') {
      return { progress, finished: false };
    }
    if (progress.done) return { progress, finished: false };
    const matched = countMatches(seed.targetSequence, action.playerSequence);
    const done = matched === seed.targetSequence.length;
    return {
      progress: {
        ...progress,
        playerSequence: action.playerSequence,
        matched,
        done,
        finishTime: done ? now : null,
      },
      finished: done,
    };
  },

  finalize(progress: PlayerProgress, seed: GameSeed, startTime: number, endTime: number): FinalizedProgress {
    if (progress.mode !== 'bottle' || seed.mode !== 'bottle') {
      return { accuracy: 0, timeMs: 0, done: false, detail: {} };
    }
    const matched = progress.done ? seed.targetSequence.length : progress.matched;
    const timeMs = progress.done && progress.finishTime !== null
      ? progress.finishTime - startTime
      : endTime - startTime;
    return {
      accuracy: matched / seed.targetSequence.length,
      timeMs,
      done: progress.done,
      detail: { matched, total: seed.targetSequence.length },
    };
  },

  computePercent(progress: PlayerProgress, seed: GameSeed): number {
    if (progress.mode !== 'bottle' || seed.mode !== 'bottle') return 0;
    return Math.round((progress.matched / seed.targetSequence.length) * 100);
  },
};
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd server && npx vitest run tests/games/bottleEngine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/games/bottleEngine.ts server/tests/games/bottleEngine.test.ts
git commit -m "feat(versus): 暗瓶引擎（6 瓶 + 目标/初始服务端生成 + race）"
```

---

## Task 7: 引擎注册表 + 全引擎回归

**Files:**
- Create: `server/src/games/registry.ts`
- Create: `server/src/games/index.ts`
- Create: `server/tests/games/registry.test.ts`

**Interfaces:**
- Produces: `ENGINES: Record<GameMode, GameEngine>`；`getEngine(mode)`；barrel `server/src/games/index.ts`

- [ ] **Step 1: 写失败测试**

创建 `server/tests/games/registry.test.ts`：
```typescript
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd server && npx vitest run tests/games/registry.test.ts`
Expected: FAIL — `Cannot find module`

- [ ] **Step 3: 实现 registry + barrel**

创建 `server/src/games/registry.ts`：
```typescript
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
```

创建 `server/src/games/index.ts`（barrel）：
```typescript
export * from './types.js';
export * from './registry.js';
export { schulteEngine } from './schulteEngine.js';
export { stroopEngine } from './stroopEngine.js';
export { sequenceEngine } from './sequenceEngine.js';
export { bottleEngine } from './bottleEngine.js';
export { gameState } from './gameState.js';
export type { VersusGame } from './gameState.js';
```

- [ ] **Step 4: 运行全部 games 测试**

Run: `cd server && npx vitest run tests/games/`
Expected: PASS（registry + 4 引擎全部通过）

- [ ] **Step 5: Commit**

```bash
git add server/src/games/registry.ts server/src/games/index.ts server/tests/games/registry.test.ts
git commit -m "feat(versus): 引擎注册表 + barrel 导出"
```

---

## Task 8: roomStore + roomHelpers 适配新字段

**Files:**
- Modify: `server/src/rooms/roomStore.ts`
- Modify: `server/src/rooms/roomHelpers.ts`
- Modify: `server/tests/roomStore.test.ts`
- Modify: `server/tests/roomHelpers.test.ts`

**Interfaces:**
- Consumes: 扩展后的 `Room`/`RoomCreateInput`/`RoomStatePayload`/`PublicRoom` from Task 1
- Produces: `createRoomStore()` 的 `create` 接受 `roundMode`/`games`；`toRoomStatePayload`/`toPublicRoom` 输出新字段

- [ ] **Step 1: 改 roomStore.create 签名**

打开 `server/src/rooms/roomStore.ts`，修改 `create` 方法，让它接受 `roundMode` + `games` 并初始化新字段。

把 `create` 的 opts 类型和函数体改为（保留现有 `get/findPublic/update/remove/count` 不变）：
```typescript
export interface RoomStore {
  create(
    hostId: string,
    host: Player,
    opts: { name?: string; roundMode: RoundMode; games: GameMode[] },
  ): Room;
  get(roomId: string): Room | null;
  findByPlayerId(userId: string): Room | null;
  findPublic(): PublicRoom[];
  update(roomId: string, mutator: (room: Room) => void): Room | null;
  remove(roomId: string): void;
  count(): number;
}
```

在 `create` 函数体里，构造 Room 时加入新字段（把现有 `gameMode ?? 'schulte'` 等默认值逻辑替换）：
```typescript
create(hostId, host, opts) {
  const roomId = randomUUID();
  const games = opts.games.length > 0 ? opts.games : ['schulte' as GameMode];
  const room: Room = {
    roomId,
    name: opts.name ?? `${host.name}的房间`,
    hostId,
    state: 'waiting',
    gameMode: games[0],
    maxPlayers: 2,
    players: [host],
    createdAt: Date.now(),
    roundMode: opts.roundMode,
    gameQueue: games,
    currentQueueIndex: 0,
    roundResults: [],
    hostCanChangeGames: false,
  };
  rooms.set(roomId, room);
  return room;
},
```

确保文件顶部 import 了 `RoundMode`：
```typescript
import type { Room, Player, GameMode, RoundMode, PublicRoom } from '../types/room.js';
```

- [ ] **Step 2: 改 roomHelpers**

打开 `server/src/rooms/roomHelpers.ts`，修改 `toRoomStatePayload` 和 `toPublicRoom`：

```typescript
export function toRoomStatePayload(room: Room): RoomStatePayload {
  return {
    roomId: room.roomId,
    name: room.name,
    state: room.state,
    players: room.players,
    gameMode: room.gameMode,
    roundMode: room.roundMode,
    gameQueue: room.gameQueue,
    currentQueueIndex: room.currentQueueIndex,
    totalInRound: room.gameQueue.length,
    hostCanChangeGames: room.hostCanChangeGames,
  };
}

export function toPublicRoom(room: Room): PublicRoom | null {
  if (room.state !== 'waiting' && room.state !== 'ready') return null;
  const host = room.players.find((p) => p.isHost);
  return {
    roomId: room.roomId,
    name: room.name,
    hostName: host?.name ?? '未知',
    playerCount: room.players.length,
    gameMode: room.gameMode,
    state: room.state,
    roundMode: room.roundMode,
    totalInRound: room.gameQueue.length,
  };
}
```

（`isFull`、`allReady`、`makeRoomName` 保持不变。）

- [ ] **Step 3: 更新现有测试**

打开 `server/tests/roomStore.test.ts`，把所有调用 `store.create(hostId, host, { name })` 的地方改为 `store.create(hostId, host, { name, roundMode: 'single', games: ['schulte'] })`。用全局搜索找所有 `store.create(` 调用点。

同样检查 `server/tests/roomHelpers.test.ts`：如果它构造 Room 字面量，补上新字段 `roundMode: 'single', gameQueue: ['schulte'], currentQueueIndex: 0, roundResults: [], hostCanChangeGames: false`。

- [ ] **Step 4: 运行测试**

Run: `cd server && npx vitest run tests/roomStore.test.ts tests/roomHelpers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/rooms/roomStore.ts server/src/rooms/roomHelpers.ts server/tests/roomStore.test.ts server/tests/roomHelpers.test.ts
git commit -m "feat(versus): roomStore/roomHelpers 适配本轮编排字段"
```

---

## Task 9: roomHandlers 改造（engine 分派 + game:action + 多局）

> 这是最核心、最大的 Task。把现有写死舒尔特的 `roomHandlers.ts` 改造成按 ENGINES 分派 + 多局推进 + reconfigure。

**Files:**
- Modify: `server/src/rooms/roomHandlers.ts`
- Modify: `server/tests/schulteHandlers.test.ts`（game:tap → game:action + 新 payload）

**Interfaces:**
- Consumes: `ENGINES`/`getEngine`/`gameState`/`VersusGame` from `server/src/games/`；扩展后的 types from Task 1, 8
- Produces: 改造后的 `attachRoomHandlers`；新事件 `game:action`/`room:reconfigure`/`room:nextRound`/`room:roundEnd`/`game:grace`

- [ ] **Step 1: 重写 roomHandlers.ts**

打开 `server/src/rooms/roomHandlers.ts`，整体替换为以下内容（保留了所有现有的事件名和流程，只是把舒尔特写死逻辑换成 engine 分派）：

```typescript
// 房间事件编排：GameEngine 分派 + 多局本轮制。
import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { Room, Player, GameMode, RoundGameResult } from '../types/room.js';
import { createRoomStore } from './roomStore.js';
import { createLobbyService } from './lobbyService.js';
import { createMatchService } from './matchService.js';
import { canTransition, nextWaitingState } from './roomStateMachine.js';
import { toPublicRoom, isFull, allReady, toRoomStatePayload, makeRoomName } from './roomHelpers.js';
import { ENGINES, getEngine, gameState, type VersusGame } from '../games/index.js';
import type { GameSeed, PlayerProgress, GameAction, FinalizedProgress } from '../games/types.js';
import { recordMatch, type MatchPlayerInput } from '../stats/statsRepository.js';
import type { PlayerResult, GameEndPayload } from '../types/schulte.js';

const COUNTDOWN_SECONDS = 3;
const MATCH_TIMEOUT_MS = 30000;
const PROGRESS_INTERVAL_MS = 500;

// 校验建房/重配的游戏选择
function validateGames(roundMode: 'single' | 'multi', games: unknown): GameMode[] | null {
  if (!Array.isArray(games) || games.length === 0) return null;
  const validModes: GameMode[] = ['schulte', 'stroop', 'sequence', 'bottle'];
  for (const g of games) {
    if (!validModes.includes(g as GameMode)) return null;
  }
  // 不可重复
  if (new Set(games).size !== games.length) return null;
  if (roundMode === 'single' && games.length !== 1) return null;
  if (roundMode === 'multi' && (games.length < 2 || games.length > 4)) return null;
  return games as GameMode[];
}

export function attachRoomHandlers(io: SocketIOServer): void {
  const store = createRoomStore();
  // 房间级定时器
  const roomTimers = new Map<string, {
    progress: ReturnType<typeof setInterval>;
    timeLimit: ReturnType<typeof setTimeout>;
    grace?: ReturnType<typeof setTimeout>;
  }>();
  const lobby = createLobbyService((socketId, event, payload) => {
    io.to(socketId).emit(event, payload);
  });
  const match = createMatchService(
    {
      onMatched: (a, b) => {
        const host: Player = { ...a, isHost: true };
        const guest: Player = { ...b, isHost: false, ready: true };
        // 快速匹配：固定单局舒尔特
        const room = store.create(a.id, host, { name: makeRoomName(a.name), roundMode: 'single', games: ['schulte'] });
        room.players.push(guest);
        room.state = nextWaitingState(room);
        joinSocketToRoom(io, a.socketId, room.roomId);
        joinSocketToRoom(io, b.socketId, room.roomId);
        broadcastRoomState(io, room);
        io.to(a.socketId).emit('match:found', { roomId: room.roomId, opponent: { id: b.id, name: b.name, avatar: b.avatar } });
        io.to(b.socketId).emit('match:found', { roomId: room.roomId, opponent: { id: a.id, name: a.name, avatar: a.avatar } });
      },
      onTimeout: (userId) => {
        const sock = findSocketByUserId(io, userId);
        sock?.emit('match:timeout');
      },
    },
    { timeoutMs: MATCH_TIMEOUT_MS },
  );

  io.on('connection', (socket: Socket) => {
    const userId = socket.userId!;

    const player = (): Player => ({
      id: userId,
      socketId: socket.id,
      name: socket.userName ?? '未知',
      avatar: socket.userAvatar ?? '❓',
      ready: true,
      isHost: false,
      connected: true,
    });

    // ===== 大厅 =====
    socket.on('lobby:subscribe', () => {
      socket.join('lobby');
      lobby.subscribe(socket.id, store.findPublic());
    });
    socket.on('lobby:unsubscribe', () => {
      socket.leave('lobby');
      lobby.unsubscribe(socket.id);
    });

    // ===== 快速匹配（固定舒尔特）=====
    socket.on('match:queue', () => {
      if (store.findByPlayerId(userId)) removePlayer(io, socket, store, lobby, userId);
      match.enqueue(userId, player());
    });
    socket.on('match:cancel', () => { match.cancel(userId); });

    // ===== 创建房间 =====
    socket.on('room:create', (input: { name?: string; roundMode?: 'single' | 'multi'; games?: GameMode[] } | undefined) => {
      if (store.findByPlayerId(userId)) removePlayer(io, socket, store, lobby, userId);
      const roundMode = input?.roundMode ?? 'single';
      const games = validateGames(roundMode, input?.games ?? ['schulte']);
      if (!games) {
        socket.emit('room:error', { message: '游戏选择不合法' });
        return;
      }
      const host: Player = { ...player(), isHost: true };
      const name = input?.name?.trim() || makeRoomName(host.name);
      const room = store.create(userId, host, { name, roundMode, games });
      joinSocketToRoom(io, socket.id, room.roomId);
      broadcastRoomState(io, room);
      const pub = toPublicRoom(room);
      if (pub) lobby.broadcastRoomAdded(pub);
    });

    // ===== 加入房间 =====
    socket.on('room:join', (input: { roomId: string }) => {
      if (store.findByPlayerId(userId)) removePlayer(io, socket, store, lobby, userId);
      const room = store.get(input.roomId);
      if (!room) { socket.emit('room:error', { message: '房间不存在' }); return; }
      if (isFull(room)) { socket.emit('room:error', { message: '房间已满' }); return; }
      const guest: Player = { ...player(), isHost: false, ready: true };
      room.players.push(guest);
      const newState = nextWaitingState(room);
      if (canTransition(room.state, newState)) room.state = newState;
      joinSocketToRoom(io, socket.id, room.roomId);
      broadcastRoomState(io, room);
      const pub = toPublicRoom(room);
      if (pub) lobby.broadcastRoomChanged(pub);
    });

    // ===== 离开 =====
    socket.on('room:leave', () => {
      removePlayer(io, socket, store, lobby, userId);
    });

    // ===== 房主重配游戏（仅本轮结束后）=====
    socket.on('room:reconfigure', (input: { roundMode: 'single' | 'multi'; games: GameMode[] }) => {
      const room = store.findByPlayerId(userId);
      if (!room) return;
      const me = room.players.find((p) => p.id === userId);
      if (!me?.isHost) { socket.emit('room:error', { message: '只有房主能更换游戏' }); return; }
      if (!room.hostCanChangeGames) { socket.emit('room:error', { message: '本轮未结束，不能更换游戏' }); return; }
      const games = validateGames(input.roundMode, input.games);
      if (!games) { socket.emit('room:error', { message: '游戏选择不合法' }); return; }
      room.roundMode = input.roundMode;
      room.gameQueue = games;
      room.currentQueueIndex = 0;
      room.roundResults = [];
      room.gameMode = games[0];
      room.hostCanChangeGames = false;
      // 重置双方准备
      room.players.forEach((p) => { p.ready = false; });
      broadcastRoomState(io, room);
    });

    // ===== 准备切换 =====
    socket.on('player:ready', (input: { ready: boolean }) => {
      const room = store.findByPlayerId(userId);
      if (!room) return;
      const p = room.players.find((x) => x.id === userId);
      if (!p) return;
      p.ready = input.ready;
      broadcastRoomState(io, room);
      const pub = toPublicRoom(room);
      if (pub) lobby.broadcastRoomChanged(pub);
    });

    // ===== 游戏动作（原 game:tap，现按 mode 分派）=====
    socket.on('game:action', (input: { mode: GameMode; payload: unknown }) => {
      const room = store.findByPlayerId(userId);
      if (!room) return;
      const game = gameState.get(room.roomId);
      if (!game || game.ended) return;
      const engine = getEngine(room.gameMode);
      const prog = game.players.get(userId);
      if (!prog) return;

      const action = { mode: room.gameMode, ...(input.payload as object) } as GameAction;
      const result = engine.applyAction(prog, action, game.seed, game.startTime, Date.now());
      gameState.updateProgress(room.roomId, userId, result.progress);

      checkGameEnd(room);
    });

    // ===== 房主开始 =====
    socket.on('room:start', () => {
      const room = store.findByPlayerId(userId);
      if (!room) return;
      const me = room.players.find((p) => p.id === userId);
      if (!me?.isHost) { socket.emit('room:error', { message: '只有房主能开始' }); return; }
      if (!isFull(room) || !allReady(room)) { socket.emit('room:error', { message: '需要全员准备' }); return; }
      if (!canTransition(room.state, 'countdown')) return;
      room.state = 'countdown';
      broadcastRoomState(io, room);
      lobby.broadcastRoomRemoved(room.roomId);

      let remaining = COUNTDOWN_SECONDS;
      io.to(room.roomId).emit('room:countdown', { remaining });
      const timer = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
          io.to(room.roomId).emit('room:countdown', { remaining });
        } else {
          clearInterval(timer);
          startGame(room);
        }
      }, 1000);
    });

    // ===== 断线 =====
    socket.on('disconnect', () => {
      lobby.unsubscribe(socket.id);
      match.cancel(userId);
      const room = store.findByPlayerId(userId);
      if (room) {
        const game = gameState.get(room.roomId);
        if (game && !game.ended) {
          endGame(room, 'disconnect', userId);
        }
      }
      removePlayer(io, socket, store, lobby, userId);
    });
  });

  // 开始一局：用引擎生成 seed，广播 game:start，启动定时器
  function startGame(room: Room): void {
    if (!canTransition(room.state, 'playing')) return;
    room.state = 'playing';
    broadcastRoomState(io, room);

    const engine = getEngine(room.gameMode);
    const seed = engine.generateSeed();
    const startTime = Date.now();
    const playerIds = room.players.map((p) => p.id);
    const players = new Map<string, PlayerProgress>();
    for (const pid of playerIds) {
      players.set(pid, engine.createProgress());
    }
    const game: VersusGame = {
      roomId: room.roomId,
      mode: room.gameMode,
      seed,
      startTime,
      timeLimitMs: engine.timeLimitMs,
      players,
      ended: false,
      graceTimerStarted: false,
    };
    gameState.create(game);

    io.to(room.roomId).emit('game:start', {
      mode: room.gameMode,
      seed,
      startTime,
      timeLimitMs: engine.timeLimitMs,
      queueIndex: room.currentQueueIndex,
      totalInRound: room.gameQueue.length,
    });

    // 进度广播
    const progressTimer = setInterval(() => {
      broadcastProgress(room.roomId);
    }, PROGRESS_INTERVAL_MS);

    // 时间上限兜底
    const timeLimitTimer = setTimeout(() => {
      const g = gameState.get(room.roomId);
      if (g && !g.ended) endGame(room, 'timeout');
    }, engine.timeLimitMs);

    roomTimers.set(room.roomId, { progress: progressTimer, timeLimit: timeLimitTimer });
  }

  // 广播进度（归一化 percent）
  function broadcastProgress(roomId: string): void {
    const game = gameState.get(roomId);
    if (!game || game.ended) return;
    const engine = getEngine(game.mode);
    const playerIds = [...game.players.keys()];
    if (playerIds.length !== 2) return;
    const [aId, bId] = playerIds;
    const pa = game.players.get(aId)!;
    const pb = game.players.get(bId)!;
    const aPercent = engine.computePercent(pa, game.seed);
    const bPercent = engine.computePercent(pb, game.seed);
    const aDone = isDone(pa);
    const bDone = isDone(pb);

    const sockA = findSocketByUserId(io, aId);
    sockA?.emit('game:progress', { mode: game.mode, me: { percent: aPercent, done: aDone }, opponent: { percent: bPercent, done: bDone } });
    const sockB = findSocketByUserId(io, bId);
    sockB?.emit('game:progress', { mode: game.mode, me: { percent: bPercent, done: bDone }, opponent: { percent: aPercent, done: aDone } });
  }

  // 判断某玩家是否「已完成」（各游戏语义不同）
  function isDone(p: PlayerProgress): boolean {
    if (p.mode === 'schulte') return p.done;
    if (p.mode === 'stroop') return p.done;
    if (p.mode === 'sequence') return p.submitted;
    if (p.mode === 'bottle') return p.done;
    return false;
  }

  // 检查游戏是否结束（按 mode 分派结算时机）
  function checkGameEnd(room: Room): void {
    const game = gameState.get(room.roomId);
    if (!game || game.ended) return;
    const engine = getEngine(game.mode);
    const progresses = [...game.players.values()];
    const anyDone = progresses.some((p) => isDone(p));
    const allDone = progresses.every((p) => isDone(p));

    if (engine.shouldEndWhenAnyDone) {
      // race：舒尔特/暗瓶——任一方完成即结束
      if (anyDone) { endGame(room, 'completed'); return; }
    } else if (game.mode === 'stroop') {
      // 字色：任一方完成 → 给对方启动宽限倒计时（只一次）
      if (anyDone && !game.graceTimerStarted) {
        game.graceTimerStarted = true;
        io.to(room.roomId).emit('game:grace', { seconds: 10 });
        const graceTimer = setTimeout(() => {
          const g = gameState.get(room.roomId);
          if (g && !g.ended) endGame(room, 'grace_timeout');
        }, 10000);
        const t = roomTimers.get(room.roomId);
        if (t) t.grace = graceTimer;
      }
      if (allDone) { endGame(room, 'completed'); return; }
    } else if (game.mode === 'sequence') {
      // 序列：双方都提交才结算（超时由 timeLimit 兜底）
      if (allDone) { endGame(room, 'completed'); return; }
    }
  }

  // 结束游戏：裁定 + 广播 + 战绩 + 多局推进
  function endGame(room: Room, reason: 'completed' | 'timeout' | 'disconnect' | 'grace_timeout', loserId?: string): void {
    const game = gameState.get(room.roomId);
    if (!game || game.ended) return;
    game.ended = true;
    gameState.markEnded(room.roomId);

    // 清理定时器
    const timers = roomTimers.get(room.roomId);
    if (timers) {
      clearInterval(timers.progress);
      clearTimeout(timers.timeLimit);
      if (timers.grace) clearTimeout(timers.grace);
      roomTimers.delete(room.roomId);
    }

    const playerIds = [...game.players.keys()];
    if (playerIds.length !== 2) { gameState.remove(room.roomId); return; }
    const [aId, bId] = playerIds;
    const engine = getEngine(game.mode);

    let aFinal: FinalizedProgress;
    let bFinal: FinalizedProgress;
    if (reason === 'disconnect' && loserId) {
      const loserIsA = loserId === aId;
      aFinal = engine.finalize(game.players.get(aId)!, game.seed, game.startTime, Date.now());
      bFinal = engine.finalize(game.players.get(bId)!, game.seed, game.startTime, Date.now());
      if (loserIsA) aFinal = { ...aFinal, accuracy: 0 };
      else bFinal = { ...bFinal, accuracy: 0 };
    } else {
      const endTime = Date.now();
      aFinal = engine.finalize(game.players.get(aId)!, game.seed, game.startTime, endTime);
      bFinal = engine.finalize(game.players.get(bId)!, game.seed, game.startTime, endTime);
    }

    const winnerFromA = determineWinner(aFinal, bFinal);
    const aWon = winnerFromA === 'me';
    const bWon = winnerFromA === 'opponent';

    const aResult: PlayerResult = { playerId: aId, found: 0, errors: 0, accuracy: aFinal.accuracy, timeMs: aFinal.timeMs, done: aFinal.done, won: aWon };
    const bResult: PlayerResult = { playerId: bId, found: 0, errors: 0, accuracy: bFinal.accuracy, timeMs: bFinal.timeMs, done: bFinal.done, won: bWon };

    emitGameEndTo(aId, aResult, bResult, aFinal.detail);
    emitGameEndTo(bId, bResult, aResult, bFinal.detail);

    // 写战绩
    const playerA = room.players.find((p) => p.id === aId);
    const playerB = room.players.find((p) => p.id === bId);
    const playersForStats: MatchPlayerInput[] = [
      { playerId: aId, name: playerA?.name ?? '未知', avatar: playerA?.avatar ?? '❓', found: 0, errors: 0, accuracy: aFinal.accuracy, timeMs: aFinal.timeMs, done: aFinal.done, won: aWon },
      { playerId: bId, name: playerB?.name ?? '未知', avatar: playerB?.avatar ?? '❓', found: 0, errors: 0, accuracy: bFinal.accuracy, timeMs: bFinal.timeMs, done: bFinal.done, won: bWon },
    ];
    const winnerId = aWon ? aId : bWon ? bId : null;
    recordMatch({ roomId: room.roomId, gameMode: room.gameMode, winnerId, players: playersForStats }).catch((err) => console.error('[stats] 战绩写入失败:', err));

    // 记入本轮结果
    const roundResult: RoundGameResult = {
      gameMode: room.gameMode,
      queueIndex: room.currentQueueIndex,
      results: [
        { playerId: aId, won: aWon, accuracy: aFinal.accuracy, timeMs: aFinal.timeMs },
        { playerId: bId, won: bWon, accuracy: bFinal.accuracy, timeMs: bFinal.timeMs },
      ],
    };
    room.roundResults.push(roundResult);

    gameState.remove(room.roomId);

    // 多局推进
    const nextIndex = room.currentQueueIndex + 1;
    if (nextIndex < room.gameQueue.length) {
      // 还有下一局
      room.currentQueueIndex = nextIndex;
      room.gameMode = room.gameQueue[nextIndex];
      room.state = 'finished';
      const newState = nextWaitingState(room);
      if (canTransition('finished', newState)) room.state = newState;
      room.players.forEach((p) => { p.ready = false; });
      broadcastRoomState(io, room);
      io.to(room.roomId).emit('room:nextRound', {
        nextMode: room.gameMode,
        queueIndex: room.currentQueueIndex,
        totalInRound: room.gameQueue.length,
        roundResults: room.roundResults,
      });
    } else {
      // 本轮结束
      room.hostCanChangeGames = true;
      room.state = 'finished';
      const newState = nextWaitingState(room);
      if (canTransition('finished', newState)) room.state = newState;
      room.players.forEach((p) => { p.ready = false; });
      broadcastRoomState(io, room);
      io.to(room.roomId).emit('room:roundEnd', { roundResults: room.roundResults });
    }
  }

  function determineWinner(a: { accuracy: number; timeMs: number }, b: { accuracy: number; timeMs: number }): 'me' | 'opponent' | 'draw' {
    if (Math.abs(a.accuracy - b.accuracy) > 1e-9) return a.accuracy > b.accuracy ? 'me' : 'opponent';
    if (a.timeMs !== b.timeMs) return a.timeMs < b.timeMs ? 'me' : 'opponent';
    return 'draw';
  }

  function emitGameEndTo(viewerId: string, myResult: PlayerResult, opponentResult: PlayerResult, detail: Record<string, unknown>): void {
    const winner: 'me' | 'opponent' | 'draw' = myResult.won ? 'me' : (opponentResult.won ? 'opponent' : 'draw');
    const payload: GameEndPayload & { detail?: Record<string, unknown> } = { winner, myResult, opponentResult, detail };
    const sock = findSocketByUserId(io, viewerId);
    sock?.emit('game:end', payload);
  }
}

// ===== 辅助函数 =====
function joinSocketToRoom(io: SocketIOServer, socketId: string, roomId: string): void {
  const sock = io.sockets.sockets.get(socketId);
  sock?.join(roomId);
}
function broadcastRoomState(io: SocketIOServer, room: Room): void {
  io.to(room.roomId).emit('room:state', toRoomStatePayload(room));
}
function findSocketByUserId(io: SocketIOServer, userId: string): Socket | undefined {
  for (const sock of io.sockets.sockets.values()) {
    if (sock.userId === userId) return sock;
  }
  return undefined;
}

// 玩家离开/断线：从房间移除，处理房主转让、本轮清空、空房销毁
function removePlayer(
  io: SocketIOServer,
  socket: Socket,
  store: ReturnType<typeof createRoomStore>,
  lobby: ReturnType<typeof createLobbyService>,
  userId: string,
): void {
  const room = store.findByPlayerId(userId);
  if (!room) return;
  const wasPublic = toPublicRoom(room) !== null;
  room.players = room.players.filter((p) => p.id !== userId);
  socket.leave(room.roomId);

  if (room.players.length === 0) {
    store.remove(room.roomId);
    if (wasPublic) lobby.broadcastRoomRemoved(room.roomId);
    return;
  }

  // 房主走了，转让
  if (room.hostId === userId) {
    const newHost = room.players[0];
    newHost.isHost = true;
    room.hostId = newHost.id;
    room.name = makeRoomName(newHost.name);
  }

  // 非房主退出 → 本轮状态全部重置（战绩已在 DB，不影响）
  room.currentQueueIndex = 0;
  room.roundResults = [];
  room.gameMode = room.gameQueue[0];
  room.hostCanChangeGames = false;
  room.players.forEach((p) => { p.ready = false; });

  const newState = nextWaitingState(room);
  if (canTransition(room.state, newState)) room.state = newState;
  broadcastRoomState(io, room);
  const pub = toPublicRoom(room);
  if (pub && wasPublic) lobby.broadcastRoomChanged(pub);
}
```

- [ ] **Step 2: 更新 schulteHandlers 集成测试**

打开 `server/tests/schulteHandlers.test.ts`，需要做这些改动：

1. `setupGame` 里 `host.emit('room:create', {})` 改为 `host.emit('room:create', { roundMode: 'single', games: ['schulte'] })`。
2. `playPerfect` 函数：现在是按 1..25 找 cellIndex。新协议 game:start 下发的是 `{ mode, seed: { grid, order, ... } }`。改成从 seed 读 order：
   ```typescript
   async function playPerfect(sock: ClientSocket, seed: { grid: number[]; order: number[] }): Promise<void> {
     for (let i = 0; i < seed.order.length; i++) {
       const target = seed.order[i];
       const cellIndex = seed.grid.indexOf(target);
       sock.emit('game:action', { mode: 'schulte', payload: { cellIndex } });
       await new Promise((r) => setTimeout(r, 10));
     }
   }
   ```
3. `setupGame` 返回值改为带 seed：
   ```typescript
   const hostStartP = expectEvent<{ mode: string; seed: { grid: number[]; order: number[] }; timeLimitMs: number }>(host, 'game:start', 6000);
   const guestStartP = expectEvent<{ mode: string; seed: { grid: number[]; order: number[] } }>(guest, 'game:start', 6000);
   ```
   返回 `{ host, guest, hostSeed: hostStart.seed, guestSeed: guestStart.seed }`。
4. 各测试里 `playPerfect(host, hostStart.grid)` 改为 `playPerfect(host, hostSeed)`。
5. progress 断言改为 `{ me: { percent: number }, opponent: { percent: number } }`：
   ```typescript
   const progP = expectEvent<{ me: { percent: number } }>(host, 'game:progress', 2000);
   ```
6. `game:tap` emit 全改为 `game:action`：
   ```typescript
   host.emit('game:action', { mode: 'schulte', payload: { cellIndex: hostSeed.grid.indexOf(target) } });
   ```

- [ ] **Step 3: 运行集成测试**

Run: `cd server && npx vitest run tests/schulteHandlers.test.ts`
Expected: PASS（舒尔特流程用新协议跑通）

- [ ] **Step 4: 运行全部后端测试**

Run: `cd server && npx vitest run`
Expected: PASS（所有测试文件）。如果 `roomHandlers.test.ts`（大厅/建房基础流程）因 `room:create {}` 空载荷失败，把那里的 `emit('room:create', {})` 也改为 `emit('room:create', { roundMode: 'single', games: ['schulte'] })`。

- [ ] **Step 5: Commit**

```bash
git add server/src/rooms/roomHandlers.ts server/tests/schulteHandlers.test.ts server/tests/roomHandlers.test.ts
git commit -m "feat(versus): roomHandlers engine 分派 + game:action + 多局推进 + reconfigure"
```

---

## Task 10: 多游戏集成测试

**Files:**
- Create: `server/tests/multiGameHandlers.test.ts`

验证四种游戏的结算时机 + 多局推进 + reconfigure。

- [ ] **Step 1: 写测试**

创建 `server/tests/multiGameHandlers.test.ts`：
```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import express from 'express';
import { authRouter } from '../src/auth/authRoutes.js';
import { attachAuthMiddleware } from '../src/realtime/socketAuth.js';
import { attachRoomHandlers } from '../src/rooms/index.js';
import './setupDb.js';

async function startTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, { cors: { origin: '*' } });
  attachAuthMiddleware(io);
  attachRoomHandlers(io);
  return new Promise<{ port: number; close: () => Promise<void> }>((resolve) => {
    httpServer.listen(0, () => {
      const port = (httpServer.address() as { port: number }).port;
      resolve({ port, close: () => new Promise<void>((res) => { io.close(); httpServer.close(() => res()); }) });
    });
  });
}
async function makeClient(port: number) {
  const r = await fetch(`http://localhost:${port}/api/auth/anonymous`, { method: 'POST' });
  const { token } = await r.json() as { token: string };
  return new Promise<ClientSocket>((resolve, reject) => {
    const s = ioc(`http://localhost:${port}`, { auth: { token } });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}
function expectEvent<T>(sock: ClientSocket, event: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`超时等 ${event}`)), timeoutMs);
    sock.once(event, (data: T) => { clearTimeout(t); resolve(data); });
  });
}

describe('多游戏对战集成', () => {
  let port = 0;
  let close: () => Promise<void> = () => Promise.resolve();
  let clients: ClientSocket[] = [];

  afterEach(async () => { clients.forEach((c) => c.disconnect()); clients = []; await close(); });

  async function setupGame(games: string[], roundMode: 'single' | 'multi' = 'single') {
    const server = await startTestServer();
    port = server.port; close = server.close;
    const host = await makeClient(port); clients.push(host);
    const guest = await makeClient(port); clients.push(guest);
    host.emit('room:create', { roundMode, games });
    const st = await expectEvent<{ roomId: string }>(host, 'room:state');
    guest.emit('room:join', { roomId: st.roomId });
    await expectEvent(host, 'room:state');
    const startP = expectEvent<{ mode: string; seed: Record<string, unknown> }>(host, 'game:start', 6000);
    const guestStartP = expectEvent(guest, 'game:start', 6000);
    host.emit('room:start');
    const start = await startP;
    await guestStartP;
    return { host, guest, start };
  }

  it('单局暗瓶：host 排对 → game:end，host 胜', async () => {
    const { host, start } = await setupGame(['bottle']);
    expect(start.mode).toBe('bottle');
    const seed = start.seed as { targetSequence: string[] };
    const endP = expectEvent<{ winner: string; myResult: { won: boolean; accuracy: number } }>(host, 'game:end', 5000);
    host.emit('game:action', { mode: 'bottle', payload: { playerSequence: seed.targetSequence } });
    const end = await endP;
    expect(end.winner).toBe('me');
    expect(end.myResult.accuracy).toBe(1);
  }, 20000);

  it('单局字色：一方答完触发 grace，对方不答 → 超时结算', async () => {
    const { host, start } = await setupGame(['stroop']);
    expect(start.mode).toBe('stroop');
    const seed = start.seed as { questions: { correctAnswer: string }[] };
    const graceP = expectEvent<{ seconds: number }>(host, 'game:grace', 5000);
    // host 答完 10 题
    for (let i = 0; i < seed.questions.length; i++) {
      host.emit('game:action', { mode: 'stroop', payload: { questionIndex: i, answer: seed.questions[i].correctAnswer } });
      await new Promise((r) => setTimeout(r, 10));
    }
    const grace = await graceP;
    expect(grace.seconds).toBe(10);
    const endP = expectEvent<{ winner: string }>(host, 'game:end', 5000);
    const end = await endP;
    expect(end.winner).toBe('me');
  }, 25000);

  it('单局序列：双方都提交才结算', async () => {
    const { host, guest, start } = await setupGame(['sequence']);
    expect(start.mode).toBe('sequence');
    const seed = start.seed as { sequence: string[] };
    // host 先提交，不应立即结算
    const hostEndP = expectEvent(host, 'game:end', 8000);
    host.emit('game:action', { mode: 'sequence', payload: { userSequence: seed.sequence } });
    // 等 1s 确认没结束
    await new Promise((r) => setTimeout(r, 1000));
    // guest 再提交 → 结算
    guest.emit('game:action', { mode: 'sequence', payload: { userSequence: seed.sequence } });
    const end = await hostEndP;
    // 双方都对 → draw
    expect(end.winner).toBe('draw');
  }, 25000);

  it('多局：舒尔特→字色，打完舒尔特收到 room:nextRound', async () => {
    const { host, start } = await setupGame(['schulte', 'stroop'], 'multi');
    expect(start.mode).toBe('schulte');
    const schulteSeed = start.seed as { grid: number[]; order: number[] };
    const nextRoundP = expectEvent<{ nextMode: string; queueIndex: number }>(host, 'room:nextRound', 8000);
    // host 点完舒尔特
    for (let i = 0; i < schulteSeed.order.length; i++) {
      const cellIndex = schulteSeed.grid.indexOf(schulteSeed.order[i]);
      host.emit('game:action', { mode: 'schulte', payload: { cellIndex } });
      await new Promise((r) => setTimeout(r, 10));
    }
    const next = await nextRoundP;
    expect(next.nextMode).toBe('stroop');
    expect(next.queueIndex).toBe(1);
  }, 25000);

  it('多局打完最后收到 room:roundEnd + hostCanChangeGames', async () => {
    const { host, start } = await setupGame(['schulte'], 'single');
    const schulteSeed = start.seed as { grid: number[]; order: number[] };
    const roundEndP = expectEvent<{ roundResults: unknown[] }>(host, 'room:roundEnd', 8000);
    for (let i = 0; i < schulteSeed.order.length; i++) {
      const cellIndex = schulteSeed.grid.indexOf(schulteSeed.order[i]);
      host.emit('game:action', { mode: 'schulte', payload: { cellIndex } });
      await new Promise((r) => setTimeout(r, 10));
    }
    const re = await roundEndP;
    expect(re.roundResults).toHaveLength(1);
    // 收到 room:state 带 hostCanChangeGames=true
    const stateP = expectEvent<{ hostCanChangeGames: boolean }>(host, 'room:state', 3000);
    const state = await stateP;
    expect(state.hostCanChangeGames).toBe(true);
  }, 25000);

  it('reconfigure：本轮结束后房主改游戏', async () => {
    const { host, start } = await setupGame(['schulte'], 'single');
    const schulteSeed = start.seed as { grid: number[]; order: number[] };
    await expectEvent(host, 'room:roundEnd', 8000);
    for (let i = 0; i < schulteSeed.order.length; i++) {
      const cellIndex = schulteSeed.grid.indexOf(schulteSeed.order[i]);
      host.emit('game:action', { mode: 'schulte', payload: { cellIndex } });
      await new Promise((r) => setTimeout(r, 10));
    }
    // 等 hostCanChangeGames
    await expectEvent<{ hostCanChangeGames: boolean }>(host, 'room:state', 3000);
    // reconfigure
    const stateP = expectEvent<{ gameMode: string; gameQueue: string[] }>(host, 'room:state', 3000);
    host.emit('room:reconfigure', { roundMode: 'single', games: ['bottle'] });
    const state = await stateP;
    expect(state.gameMode).toBe('bottle');
    expect(state.gameQueue).toEqual(['bottle']);
  }, 30000);

  it('非房主退出 → 本轮重置（roundResults 清空）', async () => {
    const { host, guest, start } = await setupGame(['schulte', 'stroop'], 'multi');
    const schulteSeed = start.seed as { grid: number[]; order: number[] };
    // 打完第一局
    await expectEvent(host, 'room:nextRound', 8000);
    for (let i = 0; i < schulteSeed.order.length; i++) {
      const cellIndex = schulteSeed.grid.indexOf(schulteSeed.order[i]);
      host.emit('game:action', { mode: 'schulte', payload: { cellIndex } });
      await new Promise((r) => setTimeout(r, 10));
    }
    // guest 退出
    const stateP = expectEvent<{ currentQueueIndex: number; roundResults: unknown[] }>(host, 'room:state', 3000);
    guest.emit('room:leave');
    const state = await stateP;
    expect(state.currentQueueIndex).toBe(0);  // 重置回 0
    expect(state.roundResults).toHaveLength(0);  // 清空
  }, 25000);
});
```

- [ ] **Step 2: 运行测试**

Run: `cd server && npx vitest run tests/multiGameHandlers.test.ts`
Expected: PASS（全部用例）。如果某个用例因时序问题 flaky，调整 timeout 或加 `await new Promise(r => setTimeout(r, 50))` 缓冲。

- [ ] **Step 3: Commit**

```bash
git add server/tests/multiGameHandlers.test.ts
git commit -m "test(versus): 多游戏集成测试（4 游戏 + 多局 + reconfigure + 退出）"
```

---

## Task 11: 前端类型扩展

**Files:**
- Modify: `brain-train/src/types/versus.ts`

**Interfaces:**
- Produces: 扩展的 `GameMode`；联合类型 `VersusGameStart`/`VersusGameProgress`；`RoundInfo`；镜像后端新 payload

- [ ] **Step 1: 扩展 versus.ts**

打开 `brain-train/src/types/versus.ts`，做以下修改：

`GameMode` 扩展（line 21 附近）：
```typescript
export type GameMode = 'schulte' | 'stroop' | 'sequence' | 'bottle';
```

新增 `RoundMode`、`RoundGameResult`、`RoundInfo`：
```typescript
export type RoundMode = 'single' | 'multi';

export interface RoundGameResult {
  gameMode: GameMode;
  queueIndex: number;
  results: { playerId: string; won: boolean; accuracy: number; timeMs: number }[];
}

export interface RoundInfo {
  roundMode: RoundMode;
  gameQueue: GameMode[];
  currentQueueIndex: number;
  totalInRound: number;
  hostCanChangeGames: boolean;
}
```

`PublicRoom` 扩展（加 roundMode + totalInRound）：
```typescript
export interface PublicRoom {
  roomId: string;
  name: string;
  hostName: string;
  playerCount: number;
  gameMode: GameMode;
  state: 'waiting' | 'ready';
  roundMode: RoundMode;
  totalInRound: number;
}
```

`RoomStatePayload` 扩展：
```typescript
export interface RoomStatePayload {
  roomId: string;
  name: string;
  state: RoomState;
  players: VersusPlayer[];
  gameMode: GameMode;
  roundMode: RoundMode;
  gameQueue: GameMode[];
  currentQueueIndex: number;
  totalInRound: number;
  hostCanChangeGames: boolean;
}
```

把现有 schulte 专属的 `GameStartPayload`/`GameProgressPayload` 改名为旧名 + 新增通用联合类型。在文件里找到现有的 `GameStartPayload` 和 `GameProgressPayload`，在它们后面追加新的通用类型：

```typescript
// ===== 多游戏通用类型（取代上面 schulte 专属的 GameStartPayload/GameProgressPayload）=====

// 字色题面（与服务端 StroopQuestionDef 对应）
export interface StroopQuestionDef {
  word: string;
  wordColor: string;
  correctAnswer: string;
  rule: 'standard' | 'reverse';
}

// 服务端下发的 seed（按 mode 区分）
export type VersusSeed =
  | { mode: 'schulte'; grid: number[]; size: number; target: number; direction: 'forward' | 'reverse' | 'random'; order: number[] }
  | { mode: 'stroop'; questions: StroopQuestionDef[]; timePerQuestionSec: number; finishGraceSec: number }
  | { mode: 'sequence'; sequence: string[]; distractors: string[]; optionPool: string[]; memorizeMs: number; recallTimeLimitMs: number }
  | { mode: 'bottle'; targetSequence: string[]; initialSequence: string[] };

// game:start（通用）
export interface VersusGameStart {
  mode: GameMode;
  seed: VersusSeed;
  startTime: number;
  timeLimitMs: number;
  queueIndex: number;
  totalInRound: number;
}

// game:progress（通用，归一化百分比）
export interface VersusGameProgress {
  mode: GameMode;
  me: { percent: number; done: boolean };
  opponent: { percent: number; done: boolean };
}

// game:end 带的 detail（各游戏特有指标）
export interface GameEndPayload {
  winner: 'me' | 'opponent' | 'draw';
  myResult: PlayerResult;
  opponentResult: PlayerResult;
  detail?: Record<string, unknown>;
}

// 新事件 payload
export interface NextRoundPayload {
  nextMode: GameMode;
  queueIndex: number;
  totalInRound: number;
  roundResults: RoundGameResult[];
}

export interface RoundEndPayload {
  roundResults: RoundGameResult[];
}

export interface GracePayload {
  seconds: number;
}
```

注意：保留旧的 `GameStartPayload`（schulte 专属那个）暂时不删，因为现有 store 还引用它——下一步 Task 12 会把 store 切到 `VersusGameStart`，届时再清理。

- [ ] **Step 2: 验证前端编译**

Run: `cd brain-train && npx tsc --noEmit`
Expected: 通过（可能有「旧 GameStartPayload 未使用」警告，无妨）。

- [ ] **Step 3: Commit**

```bash
git add brain-train/src/types/versus.ts
git commit -m "feat(versus): 前端类型扩展——多游戏联合类型 + 本轮信息"
```

---

## Task 12: 前端 store + socket session 适配

**Files:**
- Modify: `brain-train/src/stores/versusRoomStore.ts`
- Modify: `brain-train/src/lib/versusSocketSession.ts`

**Interfaces:**
- Consumes: `VersusGameStart`/`VersusGameProgress`/`RoundInfo`/`NextRoundPayload`/`RoundEndPayload`/`GracePayload` from Task 11
- Produces: store 新字段 `roundInfo`/`roundResults`/`graceSeconds`；新 view `'roundResult'`；新 actions

- [ ] **Step 1: 改 versusRoomStore.ts**

打开 `brain-train/src/stores/versusRoomStore.ts`。做以下修改：

把 `VersusView` 类型扩展加 `'roundResult'`：
```typescript
export type VersusView = 'lobby' | 'ready' | 'countdown' | 'playing' | 'result' | 'roundResult';
```

把 `gameData` 类型从 `GameStartPayload | null` 改为 `VersusGameStart | null`，`progress` 从 `GameProgressPayload | null` 改为 `VersusGameProgress | null`。在 state 接口里加新字段：
```typescript
interface VersusRoomState {
  // ... 现有字段
  gameData: VersusGameStart | null;        // 改类型
  progress: VersusGameProgress | null;     // 改类型
  // 新增
  roundInfo: RoundInfo | null;
  roundResults: RoundGameResult[];
  graceSeconds: number | null;
  // ... actions
  onGameStart: (payload: VersusGameStart) => void;
  onGameProgress: (payload: VersusGameProgress) => void;
  setRoundInfo: (info: RoundInfo) => void;
  onNextRound: (payload: NextRoundPayload) => void;
  onRoundEnd: (payload: RoundEndPayload) => void;
  setGrace: (seconds: number | null) => void;
}
```

初始 state 加：
```typescript
roundInfo: null,
roundResults: [],
graceSeconds: null,
```

`setRoomState` 要从 payload 构造 roundInfo：
```typescript
setRoomState: (payload) => set((s) => ({
  room: {
    roomId: payload.roomId,
    name: payload.name,
    state: payload.state,
    players: payload.players,
    gameMode: payload.gameMode,
  },
  roundInfo: {
    roundMode: payload.roundMode,
    gameQueue: payload.gameQueue,
    currentQueueIndex: payload.currentQueueIndex,
    totalInRound: payload.totalInRound,
    hostCanChangeGames: payload.hostCanChangeGames,
  },
  view: s.view === 'result' || s.view === 'roundResult' ? s.view : stateToView(payload.state),
})),
```

`onGameStart` 改为清 grace：
```typescript
onGameStart: (payload) => set({ gameData: payload, view: 'playing', progress: null, graceSeconds: null }),
```

新增 actions 实现：
```typescript
setRoundInfo: (info) => set({ roundInfo: info }),

onNextRound: (payload) => set((s) => ({
  roundInfo: s.roundInfo ? { ...s.roundInfo, currentQueueIndex: payload.queueIndex, hostCanChangeGames: false } : s.roundInfo,
  roundResults: payload.roundResults,
  gameData: null,
  progress: null,
  graceSeconds: null,
  endResult: null,
  view: 'ready',
})),

onRoundEnd: (payload) => set({
  roundResults: payload.roundResults,
  view: 'roundResult',
}),

setGrace: (seconds) => set({ graceSeconds: seconds }),
```

`reset` 里加 `roundInfo: null, roundResults: [], graceSeconds: null`。

- [ ] **Step 2: 改 versusSocketSession.ts**

打开 `brain-train/src/lib/versusSocketSession.ts`。在现有监听后加新事件监听：

```typescript
socket.on('game:grace', (d: GracePayload) => useVersusRoomStore.getState().setGrace(d.seconds));
socket.on('room:nextRound', (d: NextRoundPayload) => useVersusRoomStore.getState().onNextRound(d));
socket.on('room:roundEnd', (d: RoundEndPayload) => useVersusRoomStore.getState().onRoundEnd(d));
```

注意 import 新类型。现有的 `game:start`/`game:progress` 监听保持不变（payload 类型变了但 onGameStart/onGameProgress 已改签名）。

- [ ] **Step 3: 验证编译**

Run: `cd brain-train && npx tsc --noEmit`
Expected: 通过（VersusRoom.tsx / Versus.tsx 可能有类型不匹配警告，下一 Task 修）。

- [ ] **Step 4: Commit**

```bash
git add brain-train/src/stores/versusRoomStore.ts brain-train/src/lib/versusSocketSession.ts
git commit -m "feat(versus): store + socket session 适配多游戏事件"
```

---

## Task 13: 创建房间 Modal

**Files:**
- Create: `brain-train/src/components/versus/CreateRoomModal.tsx`
- Modify: `brain-train/src/pages/Versus.tsx`
- Modify: `brain-train/src/components/versus/index.ts`

- [ ] **Step 1: 写 CreateRoomModal**

创建 `brain-train/src/components/versus/CreateRoomModal.tsx`：
```tsx
import { useState } from 'react';
import type { RoundMode, GameMode } from '@/types/versus';

const GAME_OPTIONS: { mode: GameMode; label: string; icon: string }[] = [
  { mode: 'schulte', label: '舒尔特表', icon: '🔢' },
  { mode: 'stroop', label: '字色干扰', icon: '🎨' },
  { mode: 'sequence', label: '序列记忆', icon: '🧩' },
  { mode: 'bottle', label: '暗瓶排列', icon: '🍾' },
];

interface CreateRoomModalProps {
  onConfirm: (roundMode: RoundMode, games: GameMode[]) => void;
  onCancel: () => void;
}

export function CreateRoomModal({ onConfirm, onCancel }: CreateRoomModalProps) {
  const [roundMode, setRoundMode] = useState<RoundMode>('single');
  const [selected, setSelected] = useState<GameMode[]>(['schulte']);

  const toggleGame = (mode: GameMode) => {
    setSelected((prev) => {
      if (roundMode === 'single') return [mode];  // 单局只能选一个
      if (prev.includes(mode)) return prev.filter((g) => g !== mode);
      if (prev.length >= 4) return prev;  // 多局最多 4 个
      return [...prev, mode];
    });
  };

  const switchMode = (mode: RoundMode) => {
    setRoundMode(mode);
    if (mode === 'single') setSelected(selected.length > 0 ? [selected[0]] : ['schulte']);
  };

  const canConfirm = roundMode === 'single' ? selected.length === 1 : selected.length >= 2 && selected.length <= 4;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="w-[90%] max-w-md rounded-2xl bg-white p-6 dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold">创建对战房间</h2>

        {/* 对局模式 */}
        <div className="mb-4">
          <p className="mb-2 text-sm text-gray-500">对局模式</p>
          <div className="flex gap-2">
            <button
              onClick={() => switchMode('single')}
              className={`flex-1 rounded-lg py-2 text-sm ${roundMode === 'single' ? 'bg-indigo-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
            >
              单局
            </button>
            <button
              onClick={() => switchMode('multi')}
              className={`flex-1 rounded-lg py-2 text-sm ${roundMode === 'multi' ? 'bg-indigo-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
            >
              多局（2-4 种）
            </button>
          </div>
        </div>

        {/* 游戏选择 */}
        <div className="mb-4">
          <p className="mb-2 text-sm text-gray-500">
            选择游戏{roundMode === 'multi' ? `（已选 ${selected.length}/4，按选择顺序对战）` : ''}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {GAME_OPTIONS.map((g) => {
              const idx = selected.indexOf(g.mode);
              const isSelected = idx >= 0;
              return (
                <button
                  key={g.mode}
                  onClick={() => toggleGame(g.mode)}
                  className={`relative rounded-lg p-3 text-left ${isSelected ? 'bg-indigo-100 ring-2 ring-indigo-500 dark:bg-indigo-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}
                >
                  <span className="text-2xl">{g.icon}</span>
                  <span className="block text-sm font-medium">{g.label}</span>
                  {isSelected && roundMode === 'multi' && (
                    <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-xs text-white">{idx + 1}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-lg bg-gray-200 py-2 text-sm dark:bg-gray-600">取消</button>
          <button
            disabled={!canConfirm}
            onClick={() => onConfirm(roundMode, selected)}
            className="flex-1 rounded-lg bg-indigo-500 py-2 text-sm text-white disabled:opacity-40"
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 改 Versus.tsx 用 Modal**

打开 `brain-train/src/pages/Versus.tsx`。加 `showCreate` state，改 `handleCreateRoom`：

```tsx
const [showCreate, setShowCreate] = useState(false);

const handleCreateConfirm = (roundMode: RoundMode, games: GameMode[]) => {
  const socket = getSocket();
  if (!socket) return;
  socket.once('room:state', (payload: { roomId: string }) => {
    navigate(`/versus/room/${payload.roomId}`);
  });
  socket.emit('room:create', { roundMode, games });
  setShowCreate(false);
};
```

在渲染里加 Modal（原来直接调 `handleCreateRoom` 的按钮改为 `() => setShowCreate(true)`）：
```tsx
{showCreate && <CreateRoomModal onConfirm={handleCreateConfirm} onCancel={() => setShowCreate(false)} />}
```

import：
```tsx
import { CreateRoomModal } from '@/components/versus';
import type { RoundMode, GameMode } from '@/types/versus';
```

- [ ] **Step 3: 导出新组件**

打开 `brain-train/src/components/versus/index.ts`，加：
```typescript
export { CreateRoomModal } from './CreateRoomModal';
```

- [ ] **Step 4: 验证编译**

Run: `cd brain-train && npx tsc --noEmit`
Expected: 通过

- [ ] **Step 5: Commit**

```bash
git add brain-train/src/components/versus/CreateRoomModal.tsx brain-train/src/pages/Versus.tsx brain-train/src/components/versus/index.ts
git commit -m "feat(versus): 创建房间 Modal（单局/多局 + 游戏选择）"
```

---

## Task 14: 字色对战棋盘

**Files:**
- Create: `brain-train/src/components/versus/VersusStroopBoard.tsx`

- [ ] **Step 1: 写 VersusStroopBoard**

创建 `brain-train/src/components/versus/VersusStroopBoard.tsx`：
```tsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { StroopQuestionDef } from '@/types/versus';
import { STROOP_COLORS } from '@/lib/versusColors';  // 见 Step 2

interface VersusStroopBoardProps {
  questions: StroopQuestionDef[];
  timePerQuestionSec: number;
  onAnswer: (questionIndex: number, answer: string) => void;
  disabled?: boolean;
}

export function VersusStroopBoard({ questions, timePerQuestionSec, onAnswer, disabled }: VersusStroopBoardProps) {
  const [current, setCurrent] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [timeLeft, setTimeLeft] = useState(timePerQuestionSec);

  const q = questions[current];

  // 每题倒计时
  useEffect(() => {
    setTimeLeft(timePerQuestionSec);
    const deadline = Date.now() + timePerQuestionSec * 1000;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        handleAnswer('');
      }
    }, 250);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const handleAnswer = (answer: string) => {
    if (disabled || feedback) return;
    onAnswer(current, answer);
    const isCorrect = answer === q.correctAnswer;
    setFeedback(isCorrect ? 'correct' : 'wrong');
    setTimeout(() => {
      setFeedback(null);
      if (current + 1 < questions.length) {
        setCurrent((c) => c + 1);
      }
    }, 200);
  };

  // 找 wordColor 对应的颜色值
  const colorConfig = STROOP_COLORS.find((c) => c.name === q.wordColor);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* 进度 */}
      <div className="text-sm text-gray-500">
        第 {current + 1} / {questions.length} 题 · 剩余 {timeLeft}s
        {q.rule === 'standard' ? '（选颜色）' : '（选字义）'}
      </div>

      {/* 题目：字面 q.word，用 q.wordColor 颜色显示 */}
      <motion.div
        animate={feedback === 'correct' ? { scale: [1, 1.1, 1] } : feedback === 'wrong' ? { x: [0, -8, 8, 0] } : {}}
        transition={{ duration: 0.2 }}
        className="flex h-32 w-64 items-center justify-center rounded-2xl bg-gray-50 text-5xl font-bold dark:bg-gray-800"
        style={{ color: colorConfig?.value }}
      >
        {q.word}
      </motion.div>

      {/* 答案选项：6 个颜色按钮 */}
      <div className="grid grid-cols-3 gap-3">
        {STROOP_COLORS.map((c) => (
          <button
            key={c.name}
            disabled={disabled || !!feedback}
            onClick={() => handleAnswer(c.name)}
            className="rounded-lg py-3 text-white font-medium"
            style={{ backgroundColor: c.value }}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 新建 versusColors 共享常量**

创建 `brain-train/src/lib/versusColors.ts`（与后端 STROOP_COLORS 对应，前端需要颜色值用于渲染）：
```typescript
// 字色游戏的 6 色（与后端 stroopEngine STROOP_COLORS 一致）
export const STROOP_COLORS = [
  { name: '红色', value: '#ef4444' },
  { name: '蓝色', value: '#3b82f6' },
  { name: '绿色', value: '#22c55e' },
  { name: '黄色', value: '#eab308' },
  { name: '紫色', value: '#a855f7' },
  { name: '橙色', value: '#f97316' },
] as const;
```

- [ ] **Step 3: Commit**

```bash
git add brain-train/src/components/versus/VersusStroopBoard.tsx brain-train/src/lib/versusColors.ts
git commit -m "feat(versus): 字色对战棋盘组件"
```

---

## Task 15: 序列记忆对战棋盘

**Files:**
- Create: `brain-train/src/components/versus/VersusSequenceBoard.tsx`

- [ ] **Step 1: 写 VersusSequenceBoard**

创建 `brain-train/src/components/versus/VersusSequenceBoard.tsx`：
```tsx
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface VersusSequenceBoardProps {
  sequence: string[];
  optionPool: string[];      // 序列 + 干扰的打乱池
  memorizeMs: number;
  recallTimeLimitMs: number;
  onSubmit: (userSequence: string[]) => void;
  disabled?: boolean;
}

type Phase = 'memorize' | 'recall';

export function VersusSequenceBoard({ sequence, optionPool, memorizeMs, recallTimeLimitMs, onSubmit, disabled }: VersusSequenceBoardProps) {
  const [phase, setPhase] = useState<Phase>('memorize');
  const [selected, setSelected] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(Math.round(recallTimeLimitMs / 1000));
  const submittedRef = useRef(false);

  // memorize 阶段计时
  useEffect(() => {
    const t = setTimeout(() => setPhase('recall'), memorizeMs);
    return () => clearTimeout(t);
  }, [memorizeMs]);

  // recall 阶段倒计时
  useEffect(() => {
    if (phase !== 'recall') return;
    const deadline = Date.now() + recallTimeLimitMs;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        doSubmit();
      }
    }, 250);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const doSubmit = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    // 补齐到 sequence.length（没选满的位置用空串）
    const padded = [...selected];
    while (padded.length < sequence.length) padded.push('');
    onSubmit(padded);
  };

  const handleSelect = (item: string) => {
    if (disabled || phase !== 'recall' || submittedRef.current) return;
    if (selected.length >= sequence.length) return;
    const next = [...selected, item];
    setSelected(next);
    if (next.length === sequence.length) {
      // 选满自动提交
      setTimeout(() => {
        submittedRef.current = true;
        onSubmit(next);
      }, 300);
    }
  };

  const handleUndo = () => {
    if (submittedRef.current) return;
    setSelected((prev) => prev.slice(0, -1));
  };

  if (phase === 'memorize') {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-gray-500">记住以下顺序（{Math.round(memorizeMs / 1000)}秒）</p>
        <div className="flex gap-2">
          {sequence.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.15 }}
              className="flex h-16 w-16 items-center justify-center rounded-xl bg-indigo-100 text-4xl dark:bg-indigo-900/30"
            >
              {item}
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-gray-500">回忆阶段 · 剩余 {timeLeft}s</p>

      {/* 已选序列槽位 */}
      <div className="flex gap-2">
        {Array.from({ length: sequence.length }).map((_, i) => (
          <div key={i} className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 text-4xl dark:border-gray-600">
            {selected[i] ?? ''}
          </div>
        ))}
      </div>

      {/* 选项池 */}
      <div className="grid grid-cols-4 gap-2">
        {optionPool.map((item, i) => (
          <button
            key={i}
            disabled={disabled}
            onClick={() => handleSelect(item)}
            className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 text-3xl hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            {item}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={handleUndo} disabled={selected.length === 0} className="rounded-lg bg-gray-200 px-4 py-2 text-sm disabled:opacity-40 dark:bg-gray-600">撤销</button>
        {selected.length === sequence.length && (
          <button onClick={() => { submittedRef.current = true; onSubmit(selected); }} className="rounded-lg bg-indigo-500 px-4 py-2 text-sm text-white">提交</button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add brain-train/src/components/versus/VersusSequenceBoard.tsx
git commit -m "feat(versus): 序列记忆对战棋盘组件"
```

---

## Task 16: 暗瓶对战棋盘

**Files:**
- Create: `brain-train/src/components/versus/VersusBottleBoard.tsx`

- [ ] **Step 1: 写 VersusBottleBoard**

创建 `brain-train/src/components/versus/VersusBottleBoard.tsx`（简化版：点击两个瓶子交换，不走拖拽——对战场景简化交互降低复杂度）：
```tsx
import { useState } from 'react';
import { motion } from 'framer-motion';

const BOTTLE_STYLES: Record<string, string> = {
  red: 'linear-gradient(135deg, #fca5a5 0%, #dc2626 100%)',
  blue: 'linear-gradient(135deg, #93c5fd 0%, #2563eb 100%)',
  green: 'linear-gradient(135deg, #86efac 0%, #16a34a 100%)',
  yellow: 'linear-gradient(135deg, #fde047 0%, #ca8a04 100%)',
  purple: 'linear-gradient(135deg, #d8b4fe 0%, #9333ea 100%)',
  orange: 'linear-gradient(135deg, #fdba74 0%, #ea580c 100%)',
};

interface VersusBottleBoardProps {
  targetSequence: string[];
  initialSequence: string[];
  onSwap: (playerSequence: string[]) => void;
  disabled?: boolean;
}

export function VersusBottleBoard({ targetSequence, initialSequence, onSwap, disabled }: VersusBottleBoardProps) {
  const [playerSeq, setPlayerSeq] = useState<string[]>(initialSequence);
  const [selected, setSelected] = useState<number | null>(null);

  const handleClick = (index: number) => {
    if (disabled) return;
    if (selected === null) {
      setSelected(index);
    } else if (selected === index) {
      setSelected(null);
    } else {
      // 交换 selected 和 index
      const next = [...playerSeq];
      [next[selected], next[index]] = [next[index], next[selected]];
      setPlayerSeq(next);
      setSelected(null);
      onSwap(next);
    }
  };

  const matchedCount = playerSeq.filter((c, i) => c === targetSequence[i]).length;
  const isComplete = matchedCount === targetSequence.length;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 目标排列提示 */}
      <div className="flex flex-col items-center gap-1">
        <p className="text-xs text-gray-400">目标排列（从上到下）</p>
        <div className="flex gap-1">
          {targetSequence.map((c, i) => (
            <div key={i} className="h-3 w-6 rounded-sm" style={{ background: BOTTLE_STYLES[c] }} />
          ))}
      </div>
      </div>

      <p className="text-sm text-gray-500">已匹配 {matchedCount}/{targetSequence.length} · 点两个瓶子交换</p>

      {/* 瓶子（竖排）*/}
      <div className="flex flex-col-reverse gap-2">
        {playerSeq.map((color, i) => {
          const isMatched = color === targetSequence[i];
          const isSelected = selected === i;
          return (
            <motion.button
              key={i}
              layout
              onClick={() => handleClick(i)}
              animate={isSelected ? { scale: 1.1 } : { scale: 1 }}
              className={`relative h-14 w-14 rounded-lg ${isMatched ? 'ring-2 ring-green-400' : isSelected ? 'ring-2 ring-indigo-400' : ''}`}
              style={{ background: BOTTLE_STYLES[color] }}
            >
              {isMatched && <span className="absolute -right-1 -top-1 text-green-500">✓</span>}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add brain-train/src/components/versus/VersusBottleBoard.tsx
git commit -m "feat(versus): 暗瓶对战棋盘组件（点击交换）"
```

---

## Task 17: VersusSchulteBoard 适配 direction

**Files:**
- Modify: `brain-train/src/components/versus/VersusSchulteBoard.tsx`

现有 VersusSchulteBoard 假设正序（found+1）。现在服务端下发 `order` 数组（按 direction 生成的要点顺序），需用它判定下一个目标。

- [ ] **Step 1: 改 VersusSchulteBoard**

打开 `brain-train/src/components/versus/VersusSchulteBoard.tsx`。修改 props 加 `order` 和 `direction`：

```tsx
interface VersusSchulteBoardProps {
  grid: number[];
  size: number;
  order: number[];                          // 新增：要点顺序
  direction: 'forward' | 'reverse' | 'random';  // 新增
  onTap: (cellIndex: number) => void;
  disabled?: boolean;
}
```

把内部判定逻辑从「expected = foundRef.current + 1」改为「expected = order[foundRef.current]」。找到 `handleClick` 里判断正确的部分，把：
```tsx
const expectedNumber = foundRef.current + 1;
```
改为：
```tsx
const expectedNumber = order[foundRef.current];
```

在组件顶部加 direction 提示渲染（显示当前该点的数）：
```tsx
// 在 return 的 JSX 里加一个提示
<p className="text-sm text-gray-500">
  {direction === 'forward' ? '正序' : direction === 'reverse' ? '反序' : '乱序'} · 下一个：{order[foundRef.current] ?? '✓'}
</p>
```

- [ ] **Step 2: 验证编译**

Run: `cd brain-train && npx tsc --noEmit`
Expected: 通过（调用处 VersusRoom.tsx 还没传 order/direction，下一 Task 改）。

- [ ] **Step 3: Commit**

```bash
git add brain-train/src/components/versus/VersusSchulteBoard.tsx
git commit -m "feat(versus): SchulteBoard 支持 direction（order 数组）"
```

---

## Task 18: VersusRoom 棋盘分派 + 多局 UI

**Files:**
- Modify: `brain-train/src/pages/VersusRoom.tsx`
- Modify: `brain-train/src/components/versus/PlayerProgress.tsx`
- Modify: `brain-train/src/components/versus/VersusResultDialog.tsx`
- Create: `brain-train/src/components/versus/RoundResultDialog.tsx`

- [ ] **Step 1: 改 PlayerProgress 用 percent**

打开 `brain-train/src/components/versus/PlayerProgress.tsx`。把 props 从 `{ found, errors, target }` 改为 `{ percent, done }`：

```tsx
interface PlayerProgressProps {
  name: string;
  avatar: string;
  percent: number;      // 0-100
  done: boolean;
  isMe: boolean;
}
```

进度条渲染改为 `style={{ width: `${percent}%` }}`，显示 `{percent}%` 或「完成」。

- [ ] **Step 2: 改 VersusResultDialog 通用化**

打开 `brain-train/src/components/versus/VersusResultDialog.tsx`。现有它显示 `found/errors`。改为接收 `detail` 字段按 mode 显示。props 加 `mode: GameMode` 和 `detail?: Record<string, unknown>`：

```tsx
interface VersusResultDialogProps {
  result: GameEndPayload;
  mode: GameMode;
  onPlayAgain: () => void;   // 单局：再来一局；多局中途：下一局
  onExit: () => void;
  playAgainLabel?: string;   // 默认「再来一局」，多局可传「下一局」
}
```

在 ResultRow 里，根据 mode 显示不同指标：
- schulte：`detail.found / target`、`detail.errors 错点`
- stroop：`detail.correct / 10 对`、`detail.errors 错`
- sequence：`detail.positionCorrect / 6 位置对`
- bottle：`detail.matched / 6 匹配`

（如果 detail 为空，退化为只显示 accuracy + timeMs。）

- [ ] **Step 3: 写 RoundResultDialog**

创建 `brain-train/src/components/versus/RoundResultDialog.tsx`（本轮总结算）：
```tsx
import type { RoundGameResult, VersusPlayer } from '@/types/versus';

interface RoundResultDialogProps {
  roundResults: RoundGameResult[];
  players: VersusPlayer[];
  myUserId: string;
  onReconfigure: () => void;   // 房主：更换游戏
  onExit: () => void;
  canReconfigure: boolean;     // 是否房主
}

const MODE_LABELS: Record<string, string> = {
  schulte: '舒尔特', stroop: '字色', sequence: '序列', bottle: '暗瓶',
};

export function RoundResultDialog({ roundResults, players, myUserId, onReconfigure, onExit, canReconfigure }: RoundResultDialogProps) {
  // 统计双方各赢几局
  const wins: Record<string, number> = {};
  for (const r of roundResults) {
    for (const res of r.results) {
      if (res.won) wins[res.playerId] = (wins[res.playerId] ?? 0) + 1;
    }
  }
  const myWins = wins[myUserId] ?? 0;
  const opponent = players.find((p) => p.id !== myUserId);
  const opWins = opponent ? (wins[opponent.id] ?? 0) : 0;
  const totalWinner = myWins > opWins ? 'me' : opWins > myWins ? 'opponent' : 'draw';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[90%] max-w-md rounded-2xl bg-white p-6 dark:bg-gray-800">
        <h2 className="mb-4 text-center text-xl font-bold">
          {totalWinner === 'me' ? '🎉 本轮胜利！' : totalWinner === 'opponent' ? '😢 本轮落败' : '🤝 本轮平局'}
        </h2>
        <p className="mb-4 text-center text-2xl font-bold">{myWins} : {opWins}</p>

        {/* 各局结果 */}
        <div className="mb-4 space-y-2">
          {roundResults.map((r, i) => {
            const myRes = r.results.find((x) => x.playerId === myUserId);
            const opRes = r.results.find((x) => x.playerId !== myUserId);
            return (
              <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 p-2 text-sm dark:bg-gray-700">
                <span>第 {i + 1} 局 · {MODE_LABELS[r.gameMode]}</span>
                <span>
                  {myRes?.won ? '✓ 胜' : opRes?.won ? '✗ 负' : '平'}
                  <span className="ml-2 text-gray-400">{Math.round((myRes?.accuracy ?? 0) * 100)}% vs {Math.round((opRes?.accuracy ?? 0) * 100)}%</span>
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button onClick={onExit} className="flex-1 rounded-lg bg-gray-200 py-2 text-sm dark:bg-gray-600">退出</button>
          {canReconfigure && (
            <button onClick={onReconfigure} className="flex-1 rounded-lg bg-indigo-500 py-2 text-sm text-white">更换游戏</button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 改 VersusRoom.tsx 分派棋盘 + 多局 UI**

打开 `brain-train/src/pages/VersusRoom.tsx`。这是最大的前端改动。主要变更：

1. **playing 视图**：按 `gameData.mode` 分派棋盘：
```tsx
const renderBoard = () => {
  if (!gameData) return null;
  const seed = gameData.seed;
  const handleAction = (payload: unknown) => {
    getSocket()?.emit('game:action', { mode: gameData.mode, payload });
  };

  if (seed.mode === 'schulte') {
    return <VersusSchulteBoard grid={seed.grid} size={seed.size} order={seed.order} direction={seed.direction} onTap={(i) => handleAction({ cellIndex: i })} />;
  }
  if (seed.mode === 'stroop') {
    return <VersusStroopBoard questions={seed.questions} timePerQuestionSec={seed.timePerQuestionSec} onAnswer={(qi, ans) => handleAction({ questionIndex: qi, answer: ans })} />;
  }
  if (seed.mode === 'sequence') {
    return <VersusSequenceBoard sequence={seed.sequence} optionPool={seed.optionPool} memorizeMs={seed.memorizeMs} recallTimeLimitMs={seed.recallTimeLimitMs} onSubmit={(us) => handleAction({ userSequence: us })} />;
  }
  if (seed.mode === 'bottle') {
    return <VersusBottleBoard targetSequence={seed.targetSequence} initialSequence={seed.initialSequence} onSwap={(ps) => handleAction({ playerSequence: ps })} />;
  }
  return null;
};
```

2. **进度条**：用 `progress.me.percent` / `progress.opponent.percent`。

3. **ready 视图**：加本轮队列进度展示 + reconfigure 按钮（房主 + hostCanChangeGames）：
```tsx
{roundInfo && (
  <div className="mb-3 text-sm text-gray-500">
    {roundInfo.roundMode === 'multi'
      ? `多局对战 · 第 ${roundInfo.currentQueueIndex + 1}/${roundInfo.totalInRound} 局`
      : '单局对战'}
    {roundInfo.hostCanChangeGames && isHost && (
      <button onClick={() => setShowReconfigure(true)} className="ml-2 text-indigo-500">更换游戏</button>
    )}
  </div>
)}
{showReconfigure && <CreateRoomModal onConfirm={handleReconfigure} onCancel={() => setShowReconfigure(false)} />}
```

4. **result 视图**：单局用 `VersusResultDialog`（label 根据是否还有下一局显示「下一局」/「再来一局」）。

5. **roundResult 视图**：用 `RoundResultDialog`。

6. **grace 提示**：playing 视图如果 `graceSeconds !== null` 显示倒计时条。

7. **玩法规则**：根据 `room.gameMode` 从 `gameplayInstructionsMap` 取。

加 import 和必要的 handler。`handleReconfigure` 的实现：
```tsx
const handleReconfigure = (roundMode: RoundMode, games: GameMode[]) => {
  getSocket()?.emit('room:reconfigure', { roundMode, games });
  setShowReconfigure(false);
};
```
`handlePlayAgain`（单局 result 视图）：保持现有逻辑（setView('ready') + 清 gameData/progress），因为多局推进由服务端 `room:nextRound` 驱动，单局则等房主重新开始。如果当前是多局且还有下一局，按钮文字显示「下一局」但不额外 emit（nextRound 事件已经把 view 设回 ready）。

- [ ] **Step 5: 导出新组件**

`brain-train/src/components/versus/index.ts` 加：
```typescript
export { RoundResultDialog } from './RoundResultDialog';
export { VersusStroopBoard } from './VersusStroopBoard';
export { VersusSequenceBoard } from './VersusSequenceBoard';
export { VersusBottleBoard } from './VersusBottleBoard';
```

- [ ] **Step 6: 验证编译 + 构建**

Run: `cd brain-train && npx tsc --noEmit && npm run build`
Expected: 通过

- [ ] **Step 7: Commit**

```bash
git add brain-train/src/pages/VersusRoom.tsx brain-train/src/components/versus/PlayerProgress.tsx brain-train/src/components/versus/VersusResultDialog.tsx brain-train/src/components/versus/RoundResultDialog.tsx brain-train/src/components/versus/index.ts
git commit -m "feat(versus): VersusRoom 棋盘分派 + 多局 UI + 总结算"
```

---

## Task 19: 清理 + 全量验证 + 部署

**Files:**
- Cleanup: 移除后端 `server/src/schulte/` 旧引用（如果 roomHandlers 不再 import 它）
- Verify: 全量测试 + 构建

- [ ] **Step 1: 检查旧 schulte 模块引用**

Run: `cd server && grep -rn "schulte/schulteGame\|schulte/gameStore" src/`
Expected: 应无输出（roomHandlers 已改用 games/）。如果 `server/src/rooms/index.ts` 还导出旧的，检查是否需要保留。

保留 `server/src/schulte/` 目录（旧测试 schulteGame.test.ts 还在跑，作为纯逻辑回归参考）不删，但确认 `roomHandlers.ts` 不再 import 它。

- [ ] **Step 2: 后端全量测试**

Run: `cd server && npx vitest run`
Expected: 全部 PASS。如有失败，逐个修。

- [ ] **Step 3: 前端构建**

Run: `cd brain-train && npm run build`
Expected: 构建成功，无 TS 错误。

- [ ] **Step 4: 部署到服务器**

用 dokeplay-server skill：
```bash
# 后端
ssh ... "cd /data/server && git pull && npm run build && pm2 restart braintrain-server"
# 前端
ssh ... "cd /data/www && git pull && npm run build"
```

- [ ] **Step 5: 浏览器验证**

用 browser-use skill 开两个标签：
1. A 创建多局房间（舒尔特+字色），B 加入
2. 打完舒尔特 → 验证收到「下一局：字色」
3. 打字色 → 验证 grace 机制
4. 验证总结算 + reconfigure

- [ ] **Step 6: Commit + 推送**

```bash
git add -A
git commit -m "chore(versus): 多游戏扩展清理 + 部署"
git push
```

---

## 备注：类型一致性检查清单

实现时确保这些名称在前后端一致：
- `GameMode`: `'schulte' | 'stroop' | 'sequence' | 'bottle'`（前后端一致）
- `game:action` payload: `{ mode: GameMode, payload: {...} }`（前端 emit / 后端 on）
- `game:start` seed: 按 mode 区分，字段名（grid/order/questions/sequence/targetSequence 等）前后端一致
- `game:progress`: `{ mode, me: { percent, done }, opponent: { percent, done } }`
- `room:nextRound` / `room:roundEnd` / `game:grace`: 前后端事件名 + payload 字段一致
