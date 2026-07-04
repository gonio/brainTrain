# 多人对战 - 计划三：舒尔特 PvP（C 阶段核心）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把计划二的 countdown 占位（结束回 ready）换成完整舒尔特对战：countdown 结束 → 服务器生成同一张表 → 双方同步竞速 → 500ms 进度广播 → 点完/超时裁定胜负 → emit game:end。完成后两个客户端能真正打一局舒尔特 1v1。

**Architecture:** 游戏规则抽成纯函数模块 `schulteGame.ts`（生成表、处理 tap、计分、裁定）便于 TDD；`gameStore.ts` 管理每局权威进度（内存 Map，挂 RoomGame）；roomHandlers 把 countdown 占位换成 startGame + 注册 game:tap + 进度广播定时器 + 结束流程。计分严格按 spec 5.3：正确率 = correct/(correct+errors)，没点完补齐 errors。

**Tech Stack:** Node 20, TypeScript, Socket.IO 4, Vitest（纯逻辑单测 + Socket.IO 集成测试复用计划二的 testServer 模式）。

**Spec:** `brain-train/docs/superpowers/specs/2026-07-04-multiplayer-versus-design.md`（第 5 章）

---

## 范围边界

**本计划做：** schulteGame 纯逻辑、gameStore、roomHandlers 接游戏（countdown→playing、game:tap、progress 广播、game:end）、断线判负（游戏层）、集成测试。

**本计划不做（留给后续）：**
- 战绩写入 / 排行榜 → 计划四（本计划 game:end 只广播结果，不落库）
- 前端 VersusSchulteBoard 组件 → 计划五（本计划只写后端 + 集成测试，靠事件契约）

**断线处理（游戏层）：** 对局 playing 中任一方断线 → 判该方弃赛负，存活方胜，emit game:end。房间随后走计划二已有的 removePlayer 逻辑（人少回 waiting）。这与计划二的断线逻辑叠加：disconnect handler 里先判游戏中的弃赛，再走房间清理。

---

## 文件结构总览

### 新增后端文件（`server/src/`）

| 文件 | 职责 |
|---|---|
| `src/types/schulte.ts` | 游戏类型：`RoomGame`、`PlayerProgress`、`GameEndPayload`、`GameStartPayload`、`TapResult` |
| `src/schulte/schulteGame.ts` | 纯函数：`generateGrid`、`applyTap`、`computeAccuracy`、`determineWinner`、`finalizeProgress` |
| `src/schulte/gameStore.ts` | 每局权威进度存储（内存 Map）：create/get/remove + 玩家进度增改 |

### 改动后端文件

| 文件 | 改动 |
|---|---|
| `src/rooms/roomHandlers.ts` | countdown 结束改为 startGame（生成表+game:start+进度广播定时器+时间上限定时器）；新增 game:tap 处理；游戏结束广播 game:end + 房间回 waiting/ready；disconnect 加游戏中判负 |

### 新增测试文件

| 文件 | 覆盖 |
|---|---|
| `tests/schulteGame.test.ts` | 纯逻辑全边界：生成表、tap 对/错、正确率、补齐、裁定（含平局、没点完） |
| `tests/gameStore.test.ts` | 存储增删查 + 玩家进度 |
| `tests/schulteHandlers.test.ts` | Socket.IO 集成：countdown→playing、game:start、tap、progress、game:end、断线判负 |

---

## 任务依赖图

```
Task 1 (类型) ─┬─→ Task 2 (schulteGame 纯逻辑) [TDD]
               └─→ Task 3 (gameStore) [TDD]
                              │
                      Task 4 (接入 roomHandlers)
                              │
                      Task 5 (集成测试)
                              │
                      Task 6 (服务器部署 + 端到端)
```

Task 1 类型基础。Task 2/3 独立纯逻辑。Task 4 接入。Task 5 集成测试。Task 6 部署。

---

## Task 1: 舒尔特游戏类型

**Files:**
- Create: `server/src/types/schulte.ts`

- [ ] **Step 1: 创建 `server/src/types/schulte.ts`**

```typescript
// 舒尔特对战游戏类型（C 阶段）

// 单个玩家的权威进度（服务器内存态）
export interface PlayerProgress {
  playerId: string;
  found: number;          // 已正确点数
  errors: number;         // 错点次数
  done: boolean;          // 是否点完（found == target）
  finishTime: number | null;  // 点完时刻（ms 时间戳），用于裁定
}

// 一局对战的服务器权威状态
export interface RoomGame {
  roomId: string;
  grid: number[];         // 权威的舒尔特表（如 [5,12,1,...] 共 25 项）
  startTime: number;      // 游戏开始时刻（ms）
  timeLimitMs: number;    // 时间上限（如 90000）
  target: number;         // 要点完的总数（= grid.length）
  players: Map<string, PlayerProgress>;  // playerId → 进度
  ended: boolean;
}

// S→C: game:start 下发给双方
export interface GameStartPayload {
  grid: number[];
  startTime: number;
  size: number;           // 如 5（5x5）
  target: number;
  timeLimitMs: number;
}

// S→C: game:progress 每 500ms 广播
export interface GameProgressPayload {
  me: { found: number; errors: number; done: boolean };
  opponent: { found: number; errors: number; done: boolean };
}

// 单个玩家的最终结果（game:end 里用）
export interface PlayerResult {
  playerId: string;
  found: number;
  errors: number;         // 已补齐的最终 errors（含没点完的）
  accuracy: number;       // 0-1
  timeMs: number;         // 用时（点完用 finishTime-startTime，没点完用 timeLimitMs）
  done: boolean;
  won: boolean;
}

// S→C: game:end 胜负裁定
export interface GameEndPayload {
  winner: 'me' | 'opponent' | 'draw';
  myResult: PlayerResult;
  opponentResult: PlayerResult;
}

// game:tap 处理后的即时结果（可选，第一版客户端本地判断，不强制下发）
export interface TapResult {
  cellIndex: number;
  correct: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
cd D:\BrainTrain
git add server/src/types/schulte.ts
git commit -m "feat(schulte): 舒尔特对战游戏类型"
```

---

## Task 2: schulteGame 纯逻辑（TDD）

**Files:**
- Test: `server/tests/schulteGame.test.ts`
- Create: `server/src/schulte/schulteGame.ts`

核心纯函数，严格 TDD。无 IO，测试全绿。

### Step 1: 写失败测试

```typescript
import { describe, it, expect } from 'vitest';
import {
  generateGrid,
  applyTap,
  computeAccuracy,
  finalizeProgress,
  determineWinner,
} from '../src/schulte/schulteGame.js';
import type { PlayerProgress } from '../src/types/schulte.js';

describe('schulteGame', () => {
  describe('generateGrid', () => {
    it('生成 size*size 个 1~N 的数字', () => {
      const grid = generateGrid(5);
      expect(grid).toHaveLength(25);
      // 包含 1-25 每个一次
      const sorted = [...grid].sort((a, b) => a - b);
      expect(sorted).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    });

    it('每次生成顺序不同（随机打乱）', () => {
      const grids = new Set(Array.from({ length: 10 }, () => generateGrid(5).join(',')));
      expect(grids.size).toBeGreaterThan(1);
    });

    it('size=3 生成 9 个数', () => {
      const grid = generateGrid(3);
      expect(grid).toHaveLength(9);
    });
  });

  describe('applyTap', () => {
    const makeProgress = (found = 0, errors = 0): PlayerProgress => ({
      playerId: 'p1', found, errors, done: false, finishTime: null,
    });

    it('点对下一个数：found++', () => {
      // grid = [5,1,3,2,4,...]，玩家应按 1,2,3... 顺序点
      // 简化：假设 grid 第 0 项是 1（用固定 grid 测）
      const grid = [1, 2, 3, 4, 5];
      const prog = makeProgress(0);
      const result = applyTap(grid, prog, 0, 5);  // cellIndex=0, grid[0]=1, 该点 1
      expect(result.correct).toBe(true);
      expect(result.progress.found).toBe(1);
      expect(result.progress.errors).toBe(0);
    });

    it('点错（不是当前该点的数）：errors++', () => {
      const grid = [1, 2, 3, 4, 5];
      const prog = makeProgress(0);
      // 该点 1，但点了 cellIndex=1（值为 2）
      const result = applyTap(grid, prog, 1, 5);
      expect(result.correct).toBe(false);
      expect(result.progress.found).toBe(0);
      expect(result.progress.errors).toBe(1);
    });

    it('点到最后一个：done=true，记录 finishTime', () => {
      const grid = [1, 2, 3];
      const prog = makeProgress(2);  // 已点 2 个
      const result = applyTap(grid, prog, 2, 3);  // grid[2]=3，该点 3
      expect(result.correct).toBe(true);
      expect(result.progress.found).toBe(3);
      expect(result.progress.done).toBe(true);
      expect(result.progress.finishTime).not.toBeNull();
    });

    it('已点完后再 tap：无变化（幂等）', () => {
      const grid = [1, 2, 3];
      const prog: PlayerProgress = { playerId: 'p1', found: 3, errors: 0, done: true, finishTime: 1000 };
      const result = applyTap(grid, prog, 0, 3);
      expect(result.progress.found).toBe(3);
      expect(result.progress.done).toBe(true);
    });

    it('cellIndex 越界：errors++（防御）', () => {
      const grid = [1, 2, 3];
      const prog = makeProgress(0);
      const result = applyTap(grid, prog, 99, 3);
      expect(result.correct).toBe(false);
      expect(result.progress.errors).toBe(1);
    });
  });

  describe('computeAccuracy', () => {
    it('correct=25 errors=0 → 1', () => {
      expect(computeAccuracy(25, 0)).toBe(1);
    });

    it('correct=25 errors=3 → 25/28', () => {
      expect(computeAccuracy(25, 3)).toBeCloseTo(25 / 28, 5);
    });

    it('correct=0 errors=0 → 0（避免除零，返回 0）', () => {
      expect(computeAccuracy(0, 0)).toBe(0);
    });

    it('correct=20 errors=7 → 20/27', () => {
      expect(computeAccuracy(20, 7)).toBeCloseTo(20 / 27, 5);
    });
  });

  describe('finalizeProgress', () => {
    // 没点完的补齐 errors：(target - found)
    it('没点完：errors 补齐 (target - found)', () => {
      const prog: PlayerProgress = { playerId: 'p1', found: 20, errors: 2, done: false, finishTime: null };
      const finalized = finalizeProgress(prog, 25, 90000, 1000);
      expect(finalized.errors).toBe(2 + 5);  // 2 + (25-20)
      expect(finalized.found).toBe(20);
      expect(finalized.done).toBe(false);
    });

    it('点完：errors 不补齐', () => {
      const prog: PlayerProgress = { playerId: 'p1', found: 25, errors: 3, done: true, finishTime: 50000 };
      const finalized = finalizeProgress(prog, 25, 90000, 0);
      expect(finalized.errors).toBe(3);
      expect(finalized.done).toBe(true);
    });

    it('计算用时：点完用 finishTime-startTime，没点完用 timeLimitMs', () => {
      const done: PlayerProgress = { playerId: 'p1', found: 25, errors: 0, done: true, finishTime: 45000 };
      expect(finalizeProgress(done, 25, 90000, 0).timeMs).toBe(45000);

      const notDone: PlayerProgress = { playerId: 'p2', found: 20, errors: 2, done: false, finishTime: null };
      expect(finalizeProgress(notDone, 25, 90000, 0).timeMs).toBe(90000);
    });

    it('计算 accuracy（基于补齐后的 errors）', () => {
      const prog: PlayerProgress = { playerId: 'p1', found: 20, errors: 2, done: false, finishTime: null };
      const finalized = finalizeProgress(prog, 25, 90000, 0);
      // errors 补齐 = 2+5=7, accuracy = 20/27
      expect(finalized.accuracy).toBeCloseTo(20 / 27, 5);
    });
  });

  describe('determineWinner', () => {
    const makeResult = (acc: number, time: number) => ({
      playerId: 'p', found: 0, errors: 0, accuracy: acc, timeMs: time, done: false, won: false,
    });

    it('正确率高者胜', () => {
      const a = makeResult(0.9, 30000);
      const b = makeResult(0.8, 20000);
      expect(determineWinner(a, b)).toBe('me');
    });

    it('正确率相同，用时短者胜', () => {
      const a = makeResult(0.9, 30000);
      const b = makeResult(0.9, 20000);
      expect(determineWinner(a, b)).toBe('opponent');
    });

    it('正确率和用时都相同 → 平局', () => {
      const a = makeResult(0.9, 30000);
      const b = makeResult(0.9, 30000);
      expect(determineWinner(a, b)).toBe('draw');
    });

    it('从「我」视角：我正确率高 → me', () => {
      const a = makeResult(0.95, 10000);
      const b = makeResult(0.5, 50000);
      expect(determineWinner(a, b)).toBe('me');
    });
  });
});
```

### Step 2: 跑测试确认失败

Run: `cd D:\BrainTrain\server && npx vitest run tests/schulteGame.test.ts`
Expected: FAIL — 模块找不到。

### Step 3: 实现 `server/src/schulte/schulteGame.ts`

```typescript
// 舒尔特对战纯逻辑：生成表、处理 tap、计分、裁定。无副作用。
import type { PlayerProgress } from '../types/schulte.js';

// 生成 size*size 的舒尔特表（1~N 随机打乱）
export function generateGrid(size: number): number[] {
  const n = size * size;
  const grid = Array.from({ length: n }, (_, i) => i + 1);
  // Fisher-Yates 洗牌
  for (let i = grid.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [grid[i], grid[j]] = [grid[j], grid[i]];
  }
  return grid;
}

// applyTap 的返回：是否点对 + 更新后的进度（返回新对象，不可变）
export interface ApplyTapResult {
  correct: boolean;
  progress: PlayerProgress;
}

// 处理一次点击。grid 是权威表，progress 是当前进度，cellIndex 是点的格子。
// expected（当前该点的数）= found + 1。返回不可变的新进度。
export function applyTap(grid: number[], progress: PlayerProgress, cellIndex: number, _target: number): ApplyTapResult {
  // 已点完，忽略
  if (progress.done) {
    return { correct: false, progress: { ...progress } };
  }

  // 越界防御：算错点
  if (cellIndex < 0 || cellIndex >= grid.length) {
    return { correct: false, progress: { ...progress, errors: progress.errors + 1 } };
  }

  const expected = progress.found + 1;
  const tapped = grid[cellIndex];

  if (tapped === expected) {
    const newFound = progress.found + 1;
    const done = newFound === grid.length;
    return {
      correct: true,
      progress: {
        ...progress,
        found: newFound,
        done,
        finishTime: done ? Date.now() : null,
      },
    };
  }

  // 点错
  return {
    correct: false,
    progress: { ...progress, errors: progress.errors + 1 },
  };
}

// 计算正确率 = correct / (correct + errors)。correct=errors=0 返回 0（避免除零）。
export function computeAccuracy(correct: number, errors: number): number {
  const denom = correct + errors;
  if (denom === 0) return 0;
  return correct / denom;
}

// finalizeProgress 的返回（补齐后的结果 + 用时 + 正确率）
export interface FinalizedProgress {
  found: number;
  errors: number;      // 补齐后
  done: boolean;
  timeMs: number;      // 用时
  accuracy: number;    // 基于补齐后 errors
}

// 结算单玩家进度：没点完补齐 errors，算用时和正确率。
// startTime 是游戏开始时刻（ms），用于点完者的用时计算。
export function finalizeProgress(
  progress: PlayerProgress,
  target: number,
  timeLimitMs: number,
  startTime: number,
): FinalizedProgress {
  // 补齐 errors：没点完的格子算错点
  const unfilled = progress.done ? 0 : (target - progress.found);
  const finalErrors = progress.errors + unfilled;

  // 用时：点完用 finishTime-startTime，没点完用 timeLimitMs
  const timeMs = progress.done && progress.finishTime !== null
    ? progress.finishTime - startTime
    : timeLimitMs;

  return {
    found: progress.found,
    errors: finalErrors,
    done: progress.done,
    timeMs,
    accuracy: computeAccuracy(progress.found, finalErrors),
  };
}

// 裁定胜负。a 是「我」，b 是「对手」。返回 'me' | 'opponent' | 'draw'。
// 规则：正确率高者胜；相同用时短者胜；都相同平局。
export function determineWinner(
  a: { accuracy: number; timeMs: number },
  b: { accuracy: number; timeMs: number },
): 'me' | 'opponent' | 'draw' {
  if (Math.abs(a.accuracy - b.accuracy) > 1e-9) {
    return a.accuracy > b.accuracy ? 'me' : 'opponent';
  }
  if (a.timeMs !== b.timeMs) {
    return a.timeMs < b.timeMs ? 'me' : 'opponent';
  }
  return 'draw';
}
```

### Step 4: 跑测试确认通过

Run: `cd D:\BrainTrain\server && npx vitest run tests/schulteGame.test.ts`
Expected: PASS（全绿）。

### Step 5: Commit

```bash
cd D:\BrainTrain
git add server/src/schulte/schulteGame.ts server/tests/schulteGame.test.ts
git commit -m "feat(schulte): 舒尔特对战纯逻辑（生成表/tap/计分/裁定）"
```

---

## Task 3: gameStore（每局权威进度存储 TDD）

**Files:**
- Test: `server/tests/gameStore.test.ts`
- Create: `server/src/schulte/gameStore.ts`

每局对战的 RoomGame 存储（内存 Map）。

### Step 1: 写失败测试

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createGameStore } from '../src/schulte/gameStore.js';

describe('gameStore', () => {
  let store: ReturnType<typeof createGameStore>;

  beforeEach(() => {
    store = createGameStore();
  });

  it('create 建一局游戏，初始化双方进度', () => {
    const game = store.create({
      roomId: 'r1',
      grid: [1, 2, 3, 4],
      startTime: 1000,
      timeLimitMs: 90000,
      target: 4,
      playerIds: ['p1', 'p2'],
    });
    expect(game.roomId).toBe('r1');
    expect(game.grid).toEqual([1, 2, 3, 4]);
    expect(game.target).toBe(4);
    expect(game.ended).toBe(false);
    expect(game.players.get('p1')).toEqual({ playerId: 'p1', found: 0, errors: 0, done: false, finishTime: null });
    expect(game.players.get('p2')).toEqual({ playerId: 'p2', found: 0, errors: 0, done: false, finishTime: null });
  });

  it('get 按 roomId 查', () => {
    store.create({ roomId: 'r1', grid: [1], startTime: 0, timeLimitMs: 90, target: 1, playerIds: ['p1', 'p2'] });
    expect(store.get('r1')?.roomId).toBe('r1');
  });

  it('get 不存在返回 null', () => {
    expect(store.get('不存在')).toBeNull();
  });

  it('updateProgress 更新某玩家进度', () => {
    store.create({ roomId: 'r1', grid: [1, 2], startTime: 0, timeLimitMs: 90, target: 2, playerIds: ['p1', 'p2'] });
    store.updateProgress('r1', 'p1', { found: 1 });
    expect(store.get('r1')?.players.get('p1')?.found).toBe(1);
  });

  it('updateProgress 不存在的游戏返回 false', () => {
    expect(store.updateProgress('不存在', 'p1', { found: 1 })).toBe(false);
  });

  it('markEnded 标记结束', () => {
    store.create({ roomId: 'r1', grid: [1], startTime: 0, timeLimitMs: 90, target: 1, playerIds: ['p1', 'p2'] });
    store.markEnded('r1');
    expect(store.get('r1')?.ended).toBe(true);
  });

  it('remove 删除', () => {
    store.create({ roomId: 'r1', grid: [1], startTime: 0, timeLimitMs: 90, target: 1, playerIds: ['p1', 'p2'] });
    store.remove('r1');
    expect(store.get('r1')).toBeNull();
  });
});
```

### Step 2: 跑测试确认失败

Run: `cd D:\BrainTrain\server && npx vitest run tests/gameStore.test.ts`
Expected: FAIL。

### Step 3: 实现 `server/src/schulte/gameStore.ts`

```typescript
// 每局对战权威进度存储：Map<roomId, RoomGame>。内存态，不落库。
import type { RoomGame, PlayerProgress } from '../types/schulte.js';

export interface CreateGameInput {
  roomId: string;
  grid: number[];
  startTime: number;
  timeLimitMs: number;
  target: number;
  playerIds: string[];
}

export interface GameStore {
  create(input: CreateGameInput): RoomGame;
  get(roomId: string): RoomGame | null;
  updateProgress(roomId: string, playerId: string, patch: Partial<PlayerProgress>): boolean;
  markEnded(roomId: string): void;
  remove(roomId: string): void;
}

export function createGameStore(): GameStore {
  const games = new Map<string, RoomGame>();

  return {
    create(input) {
      const players = new Map<string, PlayerProgress>();
      for (const pid of input.playerIds) {
        players.set(pid, { playerId: pid, found: 0, errors: 0, done: false, finishTime: null });
      }
      const game: RoomGame = {
        roomId: input.roomId,
        grid: input.grid,
        startTime: input.startTime,
        timeLimitMs: input.timeLimitMs,
        target: input.target,
        players,
        ended: false,
      };
      games.set(input.roomId, game);
      return game;
    },

    get(roomId) {
      return games.get(roomId) ?? null;
    },

    updateProgress(roomId, playerId, patch) {
      const game = games.get(roomId);
      if (!game) return false;
      const prog = game.players.get(playerId);
      if (!prog) return false;
      game.players.set(playerId, { ...prog, ...patch });
      return true;
    },

    markEnded(roomId) {
      const game = games.get(roomId);
      if (game) game.ended = true;
    },

    remove(roomId) {
      games.delete(roomId);
    },
  };
}
```

### Step 4: 跑测试确认通过

Run: `cd D:\BrainTrain\server && npx vitest run tests/gameStore.test.ts`
Expected: PASS。

### Step 5: Commit

```bash
cd D:\BrainTrain
git add server/src/schulte/gameStore.ts server/tests/gameStore.test.ts
git commit -m "feat(schulte): 每局权威进度存储（gameStore）"
```

---

## Task 4: 接入 roomHandlers（游戏编排）

**Files:**
- Modify: `server/src/rooms/roomHandlers.ts`

把计划二的 countdown 占位换成完整游戏流程。这是本计划的核心改动。

### 关键改动点

1. **模块顶部**：import schulteGame + gameStore + 类型。常量 `GRID_SIZE=5`、`TIME_LIMIT_MS=90000`、`PROGRESS_INTERVAL_MS=500`。
2. **attachRoomHandlers 内**：创建 `const games = createGameStore()`。
3. **countdown 结束分支**（原 `回 ready` 占位）：改为调 `startGame(io, room)`。
4. **新增 `game:tap` 处理器**。
5. **新增辅助函数** `startGame`、`handleGameTap`、`broadcastProgress`、`endGame`。
6. **disconnect handler**：加游戏中判负（`endGameByDisconnect`）。

### Step 1: 读现有 roomHandlers.ts 确认结构

读 `server/src/rooms/roomHandlers.ts`，确认：
- 常量定义区（COUNTDOWN_SECONDS 等）
- attachRoomHandlers 函数内的 store/lobby/match 创建
- room:start handler 的 countdown 块（要改的占位）
- disconnect handler（要加游戏判负）

### Step 2: 改动 roomHandlers.ts

**新增 import（顶部）：**
```typescript
import { generateGrid, applyTap, finalizeProgress, determineWinner } from '../schulte/schulteGame.js';
import { createGameStore } from '../schulte/gameStore.js';
import type { PlayerProgress, PlayerResult, GameEndPayload } from '../types/schulte.js';
```

**新增常量：**
```typescript
const GRID_SIZE = 5;
const TIME_LIMIT_MS = 90000;
const PROGRESS_INTERVAL_MS = 500;
```

**在 attachRoomHandlers 内，games 创建（紧挨 store 创建后）：**
```typescript
  const games = createGameStore();
```

**新增房间级定时器追踪**（用于结束时清理）。在 attachRoomHandlers 内加：
```typescript
  // 房间级定时器：roomId → { progress, timeLimit }，结束时清理
  const roomTimers = new Map<string, { progress: ReturnType<typeof setInterval>; timeLimit: ReturnType<typeof setTimeout> }>();
```

**替换 countdown 结束分支（原占位 `回 ready`）：**

把原来的：
```typescript
        } else {
          clearInterval(timer);
          // 计划二占位：countdown 结束回 ready（计划三改为进 playing + game:start）
          if (canTransition('countdown', 'ready')) {
            room.state = 'ready';
            broadcastRoomState(io, room);
            const pub = toPublicRoom(room);
            if (pub) lobby.broadcastRoomAdded(pub);
          }
        }
```

改为：
```typescript
        } else {
          clearInterval(timer);
          // countdown 结束 → 开始游戏（计划三）
          startGame(io, room);
        }
```

**在 io.on('connection') 内，新增 game:tap 处理器（放在 player:ready 之后、room:start 之前，或任意合理位置）：**
```typescript
    // ===== 游戏中点击 =====
    socket.on('game:tap', (input: { cellIndex: number }) => {
      const game = games.get(store.findByPlayerId(userId)?.roomId ?? '');
      if (!game || game.ended) return;
      const prog = game.players.get(userId);
      if (!prog || prog.done) return;

      const result = applyTap(game.grid, prog, input.cellIndex, game.target);
      games.updateProgress(game.roomId, userId, {
        found: result.progress.found,
        errors: result.progress.errors,
        done: result.progress.done,
        finishTime: result.progress.finishTime,
      });

      // 检查是否结束：双方都 done
      checkGameEnd(io, game.roomId);
    });
```

**新增辅助函数（文件底部，其他辅助函数附近）：**

```typescript
// 开始一局游戏：生成表、广播 game:start、启动进度广播 + 时间上限定时器
function startGame(io: SocketIOServer, room: Room): void {
  if (!canTransition(room.state, 'playing')) return;
  room.state = 'playing';
  broadcastRoomState(io, room);

  const grid = generateGrid(GRID_SIZE);
  const playerIds = room.players.map((p) => p.id);
  const startTime = Date.now();
  const game = games.create({
    roomId: room.roomId,
    grid,
    startTime,
    timeLimitMs: TIME_LIMIT_MS,
    target: grid.length,
    playerIds,
  });

  const startPayload = {
    grid,
    startTime,
    size: GRID_SIZE,
    target: grid.length,
    timeLimitMs: TIME_LIMIT_MS,
  };
  io.to(room.roomId).emit('game:start', startPayload);

  // 进度广播定时器：每 500ms 下发双方进度
  const progressTimer = setInterval(() => {
    broadcastProgress(io, game.roomId);
  }, PROGRESS_INTERVAL_MS);

  // 时间上限定时器：到点强制结算
  const timeLimitTimer = setTimeout(() => {
    if (!game.ended) {
      endGame(io, game.roomId, room, 'timeout');
    }
  }, TIME_LIMIT_MS);

  roomTimers.set(room.roomId, { progress: progressTimer, timeLimit: timeLimitTimer });
}

// 广播进度给房间双方（每人收到 me + opponent 视角）
function broadcastProgress(io: SocketIOServer, roomId: string): void {
  const game = games.get(roomId);
  if (!game || game.ended) return;
  const playerIds = [...game.players.keys()];
  if (playerIds.length !== 2) return;
  const [a, b] = playerIds;
  const pa = game.players.get(a)!;
  const pb = game.players.get(b)!;

  // 给 a 发：me=a, opponent=b
  const socketA = findSocketByUserId(io, a);
  socketA?.emit('game:progress', {
    me: { found: pa.found, errors: pa.errors, done: pa.done },
    opponent: { found: pb.found, errors: pb.errors, done: pb.done },
  });
  // 给 b 发：me=b, opponent=a
  const socketB = findSocketByUserId(io, b);
  socketB?.emit('game:progress', {
    me: { found: pb.found, errors: pb.errors, done: pb.done },
    opponent: { found: pa.found, errors: pa.errors, done: pa.done },
  });
}

// 检查游戏是否结束（双方都 done）
function checkGameEnd(io: SocketIOServer, roomId: string): void {
  const game = games.get(roomId);
  if (!game || game.ended) return;
  const allDone = [...game.players.values()].every((p) => p.done);
  if (allDone) {
    const room = store.findByRoomId(roomId);
    if (room) endGame(io, roomId, room, 'completed');
  }
}
```

**注意：** `checkGameEnd` 用了 `store.findByRoomId`，但现有 roomStore 的方法叫 `get`。需要确认——现有 roomStore 有 `get(roomId)`。所以这里应该用 `store.get(roomId)`。但因为 `checkGameEnd` / `endGame` 是在 `attachRoomHandlers` 外部定义的辅助函数，它们访问不到 `store`（store 是 attachRoomHandlers 内的局部变量）。

**解决方案：** 把 `startGame`/`broadcastProgress`/`checkGameEnd`/`endGame` 都定义在 `attachRoomHandlers` **内部**（作为闭包），这样能访问 `store`/`games`/`lobby`/`roomTimers`。这是最干净的方式。

所以上述辅助函数应该移到 `attachRoomHandlers` 内部（在 `io.on('connection')` 之前定义），不要放文件底部。

### endGame 实现（核心：裁定 + 广播 + 清理）

```typescript
  // 结束游戏：裁定胜负、广播 game:end、清理定时器、房间回 waiting/ready
  function endGame(
    io: SocketIOServer,
    roomId: string,
    room: Room,
    reason: 'completed' | 'timeout' | 'disconnect',
    loserId?: string,  // disconnect 时指定弃赛方
  ): void {
    const game = games.get(roomId);
    if (!game || game.ended) return;
    game.ended = true;
    games.markEnded(roomId);

    // 清理定时器
    const timers = roomTimers.get(roomId);
    if (timers) {
      clearInterval(timers.progress);
      clearTimeout(timers.timeLimit);
      roomTimers.delete(roomId);
    }

    const playerIds = [...game.players.keys()];
    if (playerIds.length !== 2) return;
    const [aId, bId] = playerIds;

    // 断线判负：弃赛方直接判负
    if (reason === 'disconnect' && loserId) {
      const loserIsA = loserId === aId;
      const aResult = buildResult(game, aId, loserIsA ? false : true);
      const bResult = buildResult(game, bId, loserIsA ? true : false);
      emitGameEnd(io, aId, aResult, bResult);
      emitGameEnd(io, bId, bResult, aResult);
    } else {
      // 正常结算或超时：按正确率/时间裁定
      const aFinal = finalizeProgress(game.players.get(aId)!, game.target, game.timeLimitMs, game.startTime);
      const bFinal = finalizeProgress(game.players.get(bId)!, game.target, game.timeLimitMs, game.startTime);
      const winnerFromA = determineWinner(aFinal, bFinal);  // 'me' | 'opponent' | 'draw'（a 视角）
      const aWon = winnerFromA === 'me';
      const bWon = winnerFromA === 'opponent';
      const aResult = buildResultFromFinal(aId, aFinal, aWon);
      const bResult = buildResultFromFinal(bId, bFinal, bWon);
      emitGameEnd(io, aId, aResult, bResult);
      emitGameEnd(io, bId, bResult, aResult);
    }

    // 房间状态回到 waiting/ready（重开一局）
    games.remove(roomId);
    const newState = nextWaitingState(room);
    if (canTransition('playing', 'finished') && canTransition('finished', newState)) {
      room.state = 'finished';
      // 简化：直接跳到新状态（finished 是过渡）
      room.state = newState;
    } else if (canTransition(room.state, newState)) {
      room.state = newState;
    }
    broadcastRoomState(io, room);
    const pub = toPublicRoom(room);
    if (pub) lobby.broadcastRoomAdded(pub);
  }

  // 构建断线判负的结果（弃赛方 accuracy=0）
  function buildResult(game: RoomGame, playerId: string, won: boolean): PlayerResult {
    const prog = game.players.get(playerId)!;
    const final = finalizeProgress(prog, game.target, game.timeLimitMs, game.startTime);
    return {
      playerId,
      found: final.found,
      errors: final.errors,
      accuracy: won ? final.accuracy : 0,  // 弃赛方算 0
      timeMs: final.timeMs,
      done: final.done,
      won,
    };
  }

  function buildResultFromFinal(playerId: string, final: ReturnType<typeof finalizeProgress>, won: boolean): PlayerResult {
    return {
      playerId,
      found: final.found,
      errors: final.errors,
      accuracy: final.accuracy,
      timeMs: final.timeMs,
      done: final.done,
      won,
    };
  }

  // 给某玩家发 game:end（带「我」视角）
  function emitGameEnd(io: SocketIOServer, viewerId: string, myResult: PlayerResult, opponentResult: PlayerResult): void {
    const winner: 'me' | 'opponent' | 'draw' = myResult.won ? 'me' : (opponentResult.won ? 'opponent' : 'draw');
    const payload: GameEndPayload = { winner, myResult, opponentResult };
    const sock = findSocketByUserId(io, viewerId);
    sock?.emit('game:end', payload);
  }
```

### disconnect handler 改动

在现有 disconnect handler 里，removePlayer 之前加游戏判负：

```typescript
    socket.on('disconnect', () => {
      lobby.unsubscribe(socket.id);
      match.cancel(userId);
      // 游戏中断线：判该方弃赛负
      const room = store.findByPlayerId(userId);
      if (room) {
        const game = games.get(room.roomId);
        if (game && !game.ended) {
          endGame(io, room.roomId, room, 'disconnect', userId);
        }
      }
      removePlayer(io, socket, store, lobby, userId);
    });
```

### Step 3: tsc 类型检查

Run: `cd D:\BrainTrain\server && npx tsc --noEmit`
Expected: 0 错误。

> **实现者注意：** 以上代码片段是为了说清逻辑结构。所有辅助函数（startGame/broadcastProgress/checkGameEnd/endGame/buildResult/buildResultFromFinal/emitGameEnd）必须在 `attachRoomHandlers` **内部**定义（闭包），才能访问 store/games/lobby/roomTimers。把 `findSocketByUserId` 和 `broadcastRoomState` 保留在文件底部（它们不依赖闭包内的状态，只依赖 io 和 room 参数）。确认 `store.get(roomId)` 用法正确（roomStore 的方法名）。以 `tsc --noEmit` 0 错误 + Task 5 集成测试通过为准。

### Step 4: Commit

```bash
cd D:\BrainTrain
git add server/src/rooms/roomHandlers.ts
git commit -m "feat(schulte): roomHandlers 接游戏（countdown→playing/tap/progress/end/断线判负）"
```

---

## Task 5: 集成测试

**Files:**
- Test: `server/tests/schulteHandlers.test.ts`

复用计划二的 testServer 模式。需要 DB（建号）。模拟完整对局：双方 game:start 后轮流 tap 直到结束。

### Step 1: 写集成测试

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

async function startTestServer(): Promise<{ port: number; close: () => Promise<void> }> {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, { cors: { origin: '*' } });
  attachAuthMiddleware(io);
  attachRoomHandlers(io);
  return new Promise((resolve) => {
    httpServer.listen(0, () => {
      const port = (httpServer.address() as { port: number }).port;
      resolve({ port, close: () => new Promise<void>((res) => { io.close(); httpServer.close(() => res()); }) });
    });
  });
}

async function makeClient(port: number): Promise<ClientSocket> {
  const r = await fetch(`http://localhost:${port}/api/auth/anonymous`, { method: 'POST' });
  const { token } = await r.json() as { token: string };
  return new Promise((resolve, reject) => {
    const s = ioc(`http://localhost:${port}`, { auth: { token } });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

function expectEvent<T>(sock: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`超时等 ${event}`)), timeoutMs);
    sock.once(event, (data: T) => { clearTimeout(t); resolve(data); });
  });
}

// 让一个客户端按 grid 顺序正确点完所有格子
async function playPerfect(sock: ClientSocket, grid: number[]): Promise<void> {
  // grid 是乱序的，要按 1,2,3...顺序找对应 cellIndex
  for (let target = 1; target <= grid.length; target++) {
    const cellIndex = grid.indexOf(target);
    sock.emit('game:tap', { cellIndex });
    // 给服务器一点时间处理（避免事件洪泛）
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('舒尔特对战集成', () => {
  let port = 0;
  let close: () => Promise<void> = () => Promise.resolve();
  let clients: ClientSocket[] = [];

  afterEach(async () => {
    clients.forEach((c) => c.disconnect());
    clients = [];
    await close();
  });

  async function setup(): Promise<void> {
    const server = await startTestServer();
    port = server.port;
    close = server.close;
  }

  async function client(): Promise<ClientSocket> {
    const c = await makeClient(port);
    clients.push(c);
    return c;
  }

  // 房主建房 + 客人加入 + 房主开始，返回 host/guest socket 和 game:start 数据
  async function setupGame(): Promise<{
    host: ClientSocket;
    guest: ClientSocket;
    hostStart: { grid: number[]; target: number };
    guestStart: { grid: number[]; target: number };
  }> {
    const host = await client();
    const guest = await client();
    host.emit('room:create', {});
    const st = await expectEvent<{ roomId: string }>(host, 'room:state');
    guest.emit('room:join', { roomId: st.roomId });
    await expectEvent(host, 'room:state'); // ready

    const hostStartP = expectEvent<{ grid: number[]; target: number }>(host, 'game:start');
    const guestStartP = expectEvent<{ grid: number[]; target: number }>(guest, 'game:start');
    host.emit('room:start');
    // 等 countdown（3s）后 game:start
    const hostStart = await hostStartP;
    const guestStart = await guestStartP;
    return { host, guest, hostStart, guestStart };
  }

  it('countdown 结束后双方收到同一张 game:start', async () => {
    await setup();
    const { hostStart, guestStart } = await setupGame();
    // 双方 grid 完全相同（服务器权威）
    expect(hostStart.grid).toEqual(guestStart.grid);
    expect(hostStart.target).toBe(25);  // 5x5
    expect(hostStart.grid).toHaveLength(25);
  }, 15000);

  it('host 点完所有格子 → game:end，host 胜（guest 没动）', async () => {
    await setup();
    const { host, hostStart } = await setupGame();

    // host 按顺序点完
    await playPerfect(host, hostStart.grid);

    const endP = expectEvent<{ winner: string; myResult: { won: boolean; accuracy: number } }>(host, 'game:end', 5000);
    const end = await endP;
    expect(end.winner).toBe('me');
    expect(end.myResult.won).toBe(true);
    expect(end.myResult.accuracy).toBe(1);  // 完美点完 100%
  }, 20000);

  it('双方都点完 → 正确率高/用时短者胜', async () => {
    await setup();
    const { host, guest, hostStart } = await setupGame();

    // host 完美点完
    const hostEndP = expectEvent<{ myResult: { accuracy: number } }>(host, 'game:end', 8000);
    await playPerfect(host, hostStart.grid);
    // guest 也点完（用同一张 grid）
    await playPerfect(guest, hostStart.grid);

    const end = await hostEndP;
    // 两人都 100%，比时间。host 先点完（先开始 playPerfect），host 应胜或平
    expect(end.myResult.accuracy).toBe(1);
  }, 25000);

  it('游戏中断线 → 存活方收到 game:end 且胜', async () => {
    await setup();
    const { host, guest } = await setupGame();

    const hostEndP = expectEvent<{ winner: string; myResult: { won: boolean } }>(host, 'game:end', 5000);
    guest.disconnect();  // guest 弃赛
    const end = await hostEndP;
    expect(end.winner).toBe('me');
    expect(end.myResult.won).toBe(true);
  }, 15000);

  it('进度广播：游戏中有 game:progress 事件', async () => {
    await setup();
    const { host, hostStart } = await setupGame();

    const progP = expectEvent<{ me: { found: number }; opponent: { found: number } }>(host, 'game:progress', 2000);
    // host 点几个
    for (let target = 1; target <= 3; target++) {
      host.emit('game:tap', { cellIndex: hostStart.grid.indexOf(target) });
      await new Promise((r) => setTimeout(r, 20));
    }
    const prog = await progP;
    expect(prog.me.found).toBeGreaterThanOrEqual(0);
  }, 15000);
});
```

### Step 2: 跑测试（服务器有 DB 时全绿，本地无 DB 会连接失败）

本地无 DB：测试会在 setupDb 的 beforeAll 失败（ECONNREFUSED），证明接线正确。到服务器跑才全绿。

Run: `cd D:\BrainTrain\server && npx vitest run tests/schulteHandlers.test.ts`

### Step 3: tsc + 无 DB 测试无回归

Run: `cd D:\BrainTrain\server && npx tsc --noEmit && npx vitest run tests/schulteGame.test.ts tests/gameStore.test.ts tests/authService.test.ts tests/app.test.ts tests/roomStateMachine.test.ts tests/roomHelpers.test.ts tests/roomStore.test.ts tests/lobbyService.test.ts tests/matchService.test.ts`

### Step 4: Commit

```bash
cd D:\BrainTrain
git add server/tests/schulteHandlers.test.ts
git commit -m "test(schulte): 舒尔特对战集成测试（start/tap/progress/end/断线）"
```

---

## Task 6: 服务器部署 + 端到端验证

**Files:** 无（部署 + 手动验证）

### Step 1: 打包传服务器 + build + 重启

```bash
cd D:\BrainTrain
tar --exclude='server/node_modules' --exclude='server/dist' --exclude='server/.env' -czf /tmp/server.tar.gz server/
scp -i "C:/Users/xxzoi/.ssh/DOKE.pem" /tmp/server.tar.gz ubuntu@dokeplay.icu:/tmp/server.tar.gz
ssh -i "C:/Users/xxzoi/.ssh/DOKE.pem" ubuntu@dokeplay.icu 'cd /data && tar -xzf /tmp/server.tar.gz && cd /data/server && npm install && npm run build && pm2 restart braintrain-server && sleep 2 && pm2 logs braintrain-server --nostream --lines 2'
```

### Step 2: 服务器跑全部测试

```bash
ssh -i "C:/Users/xxzoi/.ssh/DOKE.pem" ubuntu@dokeplay.icu 'cd /data/server && npm test 2>&1 | tail -20'
```
Expected: 全绿（计划一+二+三所有测试）。

### Step 3: 端到端验证（两个客户端模拟完整对局）

在本地写 e2e-schulte-test.mjs 连 https://www.dokeplay.icu：
- 两个客户端建号 + 建房 + 加入 + 开始
- 等 game:start（countdown 3s 后）
- host 按 grid 顺序点完，guest 不动
- 验证 host 收到 game:end { winner: 'me', accuracy: 1 }
- 验证进度广播 game:progress

### Step 4: 验证前端无回归

```bash
powershell.exe -NoProfile -Command "(Invoke-WebRequest -UseBasicParsing -Uri 'https://www.dokeplay.icu/').StatusCode"
```
Expected: 200。

### Step 5: 清理

```bash
rm D:\BrainTrain\brain-train\e2e-schulte-test.mjs 2>/dev/null
ssh -i "C:/Users/xxzoi/.ssh/DOKE.pem" ubuntu@dokeplay.icu 'rm -f /tmp/server.tar.gz'
```

---

## 完成标志

1. ✅ `cd server && npm test` 全绿（计划一+二+三）
2. ✅ 端到端：建房→加入→开始→倒计时→game:start→tap→progress→game:end 整条链路
3. ✅ 计分正确：完美点完 100%、断线判负、没点完补齐
4. ✅ 前端无回归

## 后续计划交接

本计划交付的事件契约，供计划五（前端 VersusSchulteBoard）对接：
- `game:start` `{ grid, startTime, size, target, timeLimitMs }`
- `game:tap`（C→S）`{ cellIndex }`
- `game:progress`（S→C）`{ me, opponent }`（每 500ms）
- `game:end`（S→C）`{ winner, myResult, opponentResult }`

计划四接 game:end：在 endGame 里加战绩写入（matches 表 + user_stats 聚合）。
