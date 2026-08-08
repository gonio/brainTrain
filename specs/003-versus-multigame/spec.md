# 对战模式多游戏扩展（Versus Multi-Game）

> 状态：草案待评审
> 范围：把现有「仅舒尔特 1v1」对战扩展为「舒尔特 / 字色 / 序列记忆 / 暗瓶」四种游戏可选可编排的对战，支持单局与多局（本轮制）。
> 不在本次范围：快速匹配的多游戏化、4–8 人房间、断线重连、ELO 匹配。

---

## 1. 背景与目标

当前对战（`feat/versus-backend`）只支持舒尔特 1v1：房主建房 → 两人准备 → 倒计时 → 同表竞速 → 结算。所有游戏逻辑写死在 `server/src/schulte/` 与 `roomHandlers.ts` 里，`GameMode` 类型只有 `'schulte'` 一个字面量，前端 `VersusRoom.tsx` 直接渲染 `<VersusSchulteBoard>`。

本次目标：

1. **多游戏**：舒尔特、字色（Stroop）、序列记忆、暗瓶四种游戏都能进对战，各自独立的结算规则。
2. **单局 / 多局**：建房时选「单局」（1 种游戏）或「多局」（选 2–4 种，不可重复），多局按顺序依次打。
3. **本轮制流程**：打完所选的全部游戏算「本轮结束」，回到准备态，只有房主能重新选择游戏类型再开下一轮。
4. **公平随机**：所有随机内容（洗牌、序列、题目）由服务端统一生成下发给双方，保证同题同难度。
5. **复用单机组件**：前端不重写游戏，把现有 `SchulteGrid` / `StroopGame` / `SequenceGame` / `BottleGame` 薄封装成对战棋盘。

---

## 2. 游戏规格（固定预设）

每种游戏的对战参数固定，房主不可调。

| 游戏 | mode | 预设参数 | 「完成」定义 | 结算时机 | 胜负规则 |
|------|------|----------|--------------|----------|----------|
| 舒尔特 | `schulte` | 5×5（25 格），限时 90s，方向每局三选一随机（正序 1→25 / 反序 25→1 / 乱序） | found === 25 | **任一方完成即结束**（race） | 先完成者赢；若双方都未完成（超时），按正确率→用时 |
| 字色 | `stroop` | 10 题，每题限时 8s，mode 每题三选一随机（standard/reverse/dual），整体上限 120s | answered === 10 | **先完成者触发对方 10s 倒计时**，到时强结束 | 正确率→用时 |
| 序列记忆 | `sequence` | 序列长度 6，回忆限时 15s，回忆阶段含干扰项（distractors，选项池 = 序列 + 干扰） | 提交完整答案（6 个位置全填） | **双方都提交或 15s 超时后才结算**（非 race） | 正确率（位置准确率优先）→ 回忆阶段用时 |
| 暗瓶 | `bottle` | 6 瓶，目标排列由服务端生成，初始排列由服务端生成（双方相同），不限时 | playerSequence === targetSequence | **任一方排到正确排列即结束**（race） | 先排对者赢（不看步数）；超时（上限 180s）按已匹配数→用时 |

### 2.1 舒尔特方向说明

每局开局服务端从 `['forward', 'reverse', 'random']` 随机选一个 direction：
- `forward`：要点顺序 1, 2, 3, …, 25
- `reverse`：25, 24, 23, …, 1
- `random`：服务端生成一个 1–25 的随机排列作为「要点顺序」，前端按此顺序高亮下一个目标

direction 随 `game:start` 下发，前端据此渲染提示（如「下一个：12」或「正序」）。

### 2.2 序列记忆对战流程

1. `game:start` 下发 `{ sequence, distractors, memorizeMs: 4000, recallTimeLimitMs: 15000 }`（sequence 是 6 个 emoji，distractors 是干扰 emoji 列表）。
2. 前端先进入 **memorize 阶段**（4s 展示序列），此阶段不计用时、不进度。
3. memorize 结束 → 进入 **recall 阶段**，开始计时（15s 上限）。玩家从「序列 + 干扰」打乱的选项池里按顺序选 6 个。
4. 玩家点「提交」或选满 6 个 → 锁定答案，标记 `done`，记录 `recallTimeMs`。
5. **双方都 done 或任一方超时 15s → 服务端结算**：比位置准确率 → 回忆用时（recallTimeMs，不含 memorize）。

### 2.3 字色对战流程

1. `game:start` 下发 `{ questions: StroopQuestion[10], timePerQuestionSec: 8, finishGraceSec: 10, totalTimeLimitMs: 120000 }`。questions 是 10 道题（每题含字、色、正确答案、rule），双方相同。
2. 玩家逐题作答，答完即提交下一题。答错记 error。每题 8s 超时算错、自动跳下一题。
3. **任一方答完 10 题 → 服务端给未完成方启动 10s 宽限倒计时**（`game:grace` 事件），到时强结束。
4. 结算：正确率（正确题数 / 10）→ 用时。

### 2.4 暗瓶对战流程

1. `game:start` 下发 `{ targetSequence: string[6], initialSequence: string[6], timeLimitMs: 180000 }`。双方 target 与 initial 都相同。
2. 玩家交换瓶子排列。每次交换后前端上报当前 `playerSequence`，服务端判断是否 === targetSequence。
3. **任一方排到 target 即结束**（race，不看步数）。
4. 超时 180s 强结束，按已匹配位置数 → 用时。

---

## 3. 架构：GameEngine 抽象

把现在写死在 `roomHandlers.ts` 里的舒尔特逻辑抽象成「每游戏一个引擎」，统一接口。

### 3.1 核心接口

新建 `server/src/games/types.ts`：

```typescript
import type { GameMode } from '../types/room.js';

// 字色题目（服务端生成题面；userAnswer/isCorrect/reactionTime 由客户端作答后回填，结算页展示用）
export interface StroopQuestionDef {
  word: string;          // 显示的字（如「红」）
  wordColor: string;     // 字的颜色（如「蓝」）
  correctAnswer: string;  // standard=wordColor，reverse=word，dual 每题随机
  rule: 'standard' | 'reverse';
}

// 服务端生成的题目/种子（下发给双方的「同题」）
export type GameSeed =
  | { mode: 'schulte'; grid: number[]; size: number; target: number; direction: 'forward' | 'reverse' | 'random'; order?: number[] }
  | { mode: 'stroop'; questions: StroopQuestionDef[]; timePerQuestionSec: number; finishGraceSec: number }
  | { mode: 'sequence'; sequence: string[]; distractors: string[]; memorizeMs: number; recallTimeLimitMs: number }
  | { mode: 'bottle'; targetSequence: string[]; initialSequence: string[] };

// 玩家进度（权威，服务端内存态）。各游戏用不同子结构。
export type PlayerProgress =
  | { mode: 'schulte'; found: number; errors: number; done: boolean; finishTime: number | null }
  | { mode: 'stroop'; answered: number; correct: number; errors: number; done: boolean; finishTime: number | null; answers: boolean[] }
  | { mode: 'sequence'; submitted: boolean; userSequence: string[]; positionCorrect: number; submitTime: number | null }
  | { mode: 'bottle'; playerSequence: string[]; matched: number; done: boolean; finishTime: number | null };

// 玩家上报的动作（C→S game:action）
export type GameAction =
  | { mode: 'schulte'; cellIndex: number }
  | { mode: 'stroop'; questionIndex: number; answer: string }  // answer = 颜色名
  | { mode: 'sequence'; userSequence: string[] }     // 提交时整批上报
  | { mode: 'bottle'; playerSequence: string[] };     // 每次交换上报当前排列

export interface GameEngine {
  mode: GameMode;
  timeLimitMs: number;                          // 该游戏的整体时间上限
  generateSeed(): GameSeed;                     // 服务端统一生成（双方相同）
  createProgress(playerId: string): PlayerProgress;
  applyAction(progress: PlayerProgress, action: GameAction, seed: GameSeed, startTime: number): { progress: PlayerProgress; finished: boolean };
  finalize(progress: PlayerProgress, seed: GameSeed, startTime: number, endTime: number): FinalizedProgress;
  computePercent(progress: PlayerProgress, seed: GameSeed): number;  // 0–100，前端进度条用
  shouldEndWhenAnyDone: boolean;                // true=race（舒尔特/暗瓶），false=等双方（序列/字色用宽限机制）
}
```

### 3.2 四个引擎实现

- `server/src/games/schulteEngine.ts`：迁移现有 `schulteGame.ts` 的 `generateGrid/applyTap/finalizeProgress`，新增 direction 逻辑。`shouldEndWhenAnyDone = true`。
- `server/src/games/stroopEngine.ts`：新建。`generateSeed` 生成 10 题（复用前端 Stroop 的题目生成逻辑，搬到服务端）。`applyAction` 记录每题对错。`shouldEndWhenAnyDone = false`（用宽限倒计时）。
- `server/src/games/sequenceEngine.ts`：新建。`generateSeed` 从 12 emoji 池选 6 个 + 干扰。`applyAction` 接收提交的 userSequence，算 positionCorrect。`shouldEndWhenAnyDone = false`。
- `server/src/games/bottleEngine.ts`：新建。`generateSeed` 选 6 色、生成 target（shuffle）、initial（shuffle 直到与 target 不全同）。`applyAction` 比对 playerSequence === target。`shouldEndWhenAnyDone = true`。
- `server/src/games/registry.ts`：`ENGINES: Record<GameMode, GameEngine>`，单例。

`finalize` 返回统一的 `FinalizedProgress`（accuracy、timeMs、done、以及各游戏特有的 detail 字段供结果页展示）。`determineWinner` 保持通用（accuracy → timeMs），序列记忆用 positionAccuracy 作为 accuracy。

### 3.3 roomHandlers 改造

`roomHandlers.ts` 不再 import `../schulte/`，改用 `ENGINES[room.gameMode]` 分派：

- `startGame(room)`：`const engine = ENGINES[room.gameMode]`；`seed = engine.generateSeed()`；用 seed 里的 timeLimitMs 启动定时器；`game:start` 下发 `{ mode, seed, startTime, timeLimitMs }`。
- `game:action`（原 `game:tap` 重命名）：`engine.applyAction(...)`；更新进度；按 `engine.shouldEndWhenAnyDone` 或各游戏特殊规则判断是否结束。
- `broadcastProgress`：发 `{ mode, me: { percent, done }, opponent: { percent, done } }`，percent 由 `engine.computePercent` 算。
- `endGame`：`engine.finalize` + `determineWinner`；写战绩时 `gameMode: room.gameMode`。

### 3.4 结算时机分派

不是所有游戏都「任一方完成即结束」。统一规则：

```typescript
function checkGameEnd(roomId: string): void {
  const engine = ENGINES[room.gameMode];
  const progresses = [...game.players.values()];
  const anyDone = progresses.some(p => p.done);
  const allDone = progresses.every(p => p.done);

  if (engine.mode === 'schulte' || engine.mode === 'bottle') {
    // race：任一方完成即结束
    if (anyDone) endGame(room, 'completed');
  } else if (engine.mode === 'stroop') {
    // 字色：任一方完成 → 给对方启动 10s 宽限倒计时（只启动一次）
    if (anyDone && !game.graceTimerStarted) {
      game.graceTimerStarted = true;
      io.to(room.roomId).emit('game:grace', { seconds: 10 });
      game.graceTimer = setTimeout(() => endGame(room, 'grace_timeout'), 10000);
    }
    if (allDone) endGame(room, 'completed');
    // 整体 120s 总上限由 startGame 的时间上限定时器兜底（与舒尔特 90s 同机制）
  } else if (engine.mode === 'sequence') {
    // 序列：双方都提交或 15s 超时才结算
    if (allDone) endGame(room, 'completed');
    // 15s 超时由 startGame 的时间上限定时器兜底
  }
}
```

---

## 4. 房间与轮次模型

### 4.1 Room 类型扩展

```typescript
export type RoundMode = 'single' | 'multi';

export interface Room {
  // ... 现有字段
  gameMode: GameMode;              // 当前正在打的游戏（运行时，由队列推进）
  roundMode: RoundMode;            // 单局 / 多局
  gameQueue: GameMode[];           // 本轮游戏队列（single=[X]，multi=[A,B,...]）
  currentQueueIndex: number;       // 当前打到第几局（0-based）
  roundResults: RoundGameResult[]; // 本轮已结算的各局结果（房间内进行中状态；对手退出即清空）
  hostCanChangeGames: boolean;     // 本轮是否已结束（true 时房主可改游戏类型）
}

export interface RoundGameResult {
  gameMode: GameMode;
  queueIndex: number;
  // 中立结果（不偏向任一方），存双方 id + 胜负 + 关键指标
  results: { playerId: string; won: boolean; accuracy: number; timeMs: number }[];
}
// 注：roundResults 是「A vs B 这一轮」的房间内进度，对手一走就清空。
// 永久战绩在 Postgres matches 表（endGame 每局落库），不受退出影响。
```

### 4.2 建房输入扩展

```typescript
export interface RoomCreateInput {
  name?: string;
  roundMode: RoundMode;       // 必填
  games: GameMode[];          // 必填：single 时长度 1，multi 时 2–4 且不可重复
}
```

建房时校验：`games` 长度符合 roundMode、无重复、都是合法 GameMode。`gameQueue = games`，`currentQueueIndex = 0`，`gameMode = games[0]`，`roundResults = []`，`hostCanChangeGames = false`。

### 4.3 本轮流程状态机

```
[本轮进行中]
  waiting → ready → countdown → playing → finished
                                         │
                                         ├─ currentQueueIndex < gameQueue.length - 1
                                         │   → 推进 index，gameMode = gameQueue[index+1]
                                         │   → 广播 room:nextRound { nextMode, queueIndex, roundResults }
                                         │   → 回 ready（需重新准备）
                                         │
                                         └─ currentQueueIndex === gameQueue.length - 1
                                             → 本轮结束
                                             → 广播 room:roundEnd { roundResults }
                                             → hostCanChangeGames = true
                                             → 回 ready（房主可改游戏类型，改后重新计数）

[房主改游戏类型]（仅 hostCanChangeGames === true 时）
  room:reconfigure { roundMode, games } → 校验 → 重置 gameQueue/currentQueueIndex/roundResults
                                         → hostCanChangeGames = false
                                         → 广播 room:state
```

每局结束（`endGame`）后：
- `currentQueueIndex++`
- 若 `< gameQueue.length`：`gameMode = gameQueue[currentQueueIndex]`，广播 `room:nextRound`，回 ready。
- 若 `=== gameQueue.length`：广播 `room:roundEnd`，`hostCanChangeGames = true`，回 ready。

`room:nextRound` / `room:roundEnd` 是新事件。前端收到后：nextRound → 显示「下一局：字色」+ 重置准备；roundEnd → 显示总结算弹窗 + 房主出现「更换游戏」入口。

---

## 5. Socket 事件协议

### 5.1 新增 / 变更事件

| 方向 | 事件 | 载荷 | 说明 |
|------|------|------|------|
| C→S | `room:create` | `{ roundMode, games, name? }` | **变更**：增加 roundMode + games |
| C→S | `room:reconfigure` | `{ roundMode, games }` | **新增**：房主本轮结束后改游戏类型 |
| C→S | `game:action` | `GameAction`（discriminated union） | **重命名**：原 `game:tap`，现在按 mode 区分 |
| S→C | `game:start` | `{ mode, seed: GameSeed, startTime, timeLimitMs, queueIndex, totalInRound }` | **变更**：discriminated union seed。顶层 `mode` 是 `seed.mode` 的便捷镜像，前端分派棋盘组件时无需先 narrow union |
| S→C | `game:progress` | `{ mode, me: {percent, done}, opponent: {percent, done} }` | **变更**：归一化 percent |
| S→C | `game:grace` | `{ seconds: 10 }` | **新增**：字色先完成者触发对方宽限倒计时 |
| S→C | `room:nextRound` | `{ nextMode, queueIndex, totalInRound, roundResults }` | **新增**：多局推进 |
| S→C | `room:roundEnd` | `{ roundResults }` | **新增**：本轮全部结束 |
| S→C | `room:state` | `RoomStatePayload`（增加 roundMode/gameQueue/currentQueueIndex/roundResults） | **变更** |

### 5.2 向后兼容

`game:tap` 重命名为 `game:action`。因为前后端同步发布，不做兼容期。旧客户端连新版后端会因 `game:tap` 无响应而无法点击——本次一次性升级，不做降级。

---

## 6. 前端设计

### 6.1 创建房间 UI（`Versus.tsx`）

建房弹层（Modal）：

1. 第一行：**对局模式** 单选 — `[单局] [多局]`
2. 第二行：**游戏选择** —
   - 单局：4 个游戏卡片四选一
   - 多局：4 个游戏卡片多选（2–4 个，不可重复选同一个），显示已选顺序
3. 确认按钮：`room:create { roundMode, games }` → 等 `room:state` → 跳房间页

大厅房间列表（`PublicRoom`）展示当前 `gameMode`（多局显示「多局·3 种」）。

### 6.2 房间页（`VersusRoom.tsx`）

**ready 视图**：
- 显示本轮游戏队列进度：`第 2/4 局 · 当前：字色`，已完成局用 ✓ 标记 + 小结（赢/输）
- 准备按钮（非房主）/ 开始按钮（房主，需全员准备）
- 玩法规则卡：根据当前 `gameMode` 显示对应说明（复用 `gameplayInstructionsMap`）
- **本轮结束后**（`hostCanChangeGames`）：房主看到「更换游戏类型」按钮 → 打开 reconfigure 弹层（同建房 UI）

**countdown 视图**：同现有。

**playing 视图**：
- 顶部：双方进度条（percent，0–100%）
- 中间：按 `gameMode` 分派棋盘组件：
  ```tsx
  const BOARD = {
    schulte: VersusSchulteBoard,
    stroop: VersusStroopBoard,
    sequence: VersusSequenceBoard,
    bottle: VersusBottleBoard,
  };
  const Board = BOARD[gameMode];
  <Board seed={seed} onAction={emitAction} onPercent={...} />
  ```
- 字色收到 `game:grace` 时显示「对方已完成，10s 后结束」倒计时条

**result 视图**：
- 单局结算：同现有 `VersusResultDialog`（显示双方 accuracy/timeMs + 胜负）
- 多局中途局结算：显示本局结果 + 「下一局：X」+ 准备按钮（不再「再来一局」，因为流程由队列驱动）
- 本轮结束（`room:roundEnd`）：显示总结算（各局胜负 + 总胜负）+ 房主的「更换游戏」入口

### 6.3 对战棋盘组件（4 个薄封装）

每个 `VersusXxxBoard` 接收 `seed`（服务端题目），内部用对应单机组件渲染，把单机组件的回调翻译成 `game:action`：

- **VersusSchulteBoard**：现有，改造成接收 `{ grid, direction, order }`，按 direction 高亮下一个目标。`onTap(cellIndex)` → `emit('game:action', { mode:'schulte', cellIndex })`。
- **VersusStroopBoard**：用 `StroopGame` 组件，传入 `questions`（来自 seed）。`onAnswer(q)` → `emit('game:action', { mode:'stroop', questionIndex, answer })`。本地即时反馈对错。
- **VersusSequenceBoard**：先 memorize 倒计时（4s 展示 seed.sequence），再进 recall 用 `SequenceGame`（传入 sequence + distractors）。提交 → `emit('game:action', { mode:'sequence', userSequence })`。
- **VersusBottleBoard**：用 `BottleGame`，传入 target + initial。每次交换 `onSwap` → `emit('game:action', { mode:'bottle', playerSequence })`。

### 6.4 Store 变更（`versusRoomStore.ts`）

- `gameData` 类型从 `GameStartPayload`（舒尔特专属）改为 discriminated union（带 mode）。
- 新增 `roundInfo: { roundMode, gameQueue, currentQueueIndex, totalInRound, hostCanChangeGames }`。
- 新增 `roundResults: RoundGameResult[]`。
- `game:progress` reducer 改为存 `{ mePercent, opponentPercent, meDone, opponentDone }`。
- 新增 reducer：`room:nextRound`（推进 roundInfo + 重置 gameData/progress + view 回 ready）、`room:roundEnd`（view → 'roundResult'）。
- view 类型从 `'lobby' | 'ready' | 'countdown' | 'playing' | 'result'` 扩展为 `'lobby' | 'ready' | 'countdown' | 'playing' | 'result' | 'roundResult'`。`result` 用于单局结算，`roundResult` 用于本轮总结算。

### 6.5 玩法说明（rules）

`gameplayInstructionsMap` 已有四种游戏的说明文本，直接复用。ready 视图按当前 `gameMode` 取对应说明。

---

## 7. 退出与中断处理

### 7.1 局间退出（ready / finished 视图）

**两个层面要分清**：

1. **个人战绩（Postgres `matches` 表）——永久保留**：每完成一局 `endGame` 就调用 `recordMatch` 落库，是双方各自的个人战绩，退出绝不让它失效。多局对战只是「连续打多场独立对局」的便利，每打完一局就等于打完了一场，战绩已入库。
2. **房间内本轮队列（内存态 `roundResults`/`currentQueueIndex`）——本轮终止即清空**：这是「房主 A 与对手 B 的这一系列对战」的进行中状态。一旦 B 退出，A 与 B 的本轮对战就此结束（不是暂停），房间内本轮状态全部重置。

- **非房主退出**（`room:leave`）：该玩家移除，房间回 `waiting`，房主留下等人。**本轮状态全部重置**——`gameQueue` 配置保留，但 `currentQueueIndex` 回 0、`roundResults` 清空、`hostCanChangeGames = false`。新人加入、双方准备后，从第一局重新开始打（这是房主 A 与新对手 C 的全新一轮对战）。已落库的 A vs B 各局战绩不受影响。
- **房主退出**：广播 `room:closed`，全员被踢回大厅，房间销毁。已落库战绩同样不受影响。

### 7.2 游戏中退出 / 断线

同现有：断线方判负，本局立即结算（`endGame(room, 'disconnect', loserId)`），然后按多局流程推进（若还有下一局则推进，否则本轮结束）。

### 7.3 房主转让

房主退出时若有其他玩家，转让房主（现有逻辑保留）。新房主继承 `hostCanChangeGames` 状态。

---

## 8. 战绩与排行榜

- `recordMatch` 每局都写一条（`gameMode` 字段已有，现在会是 stroop/sequence/bottle）。
- 排行榜现有逻辑按 gameMode 聚合统计——需扩展为支持按 gameMode 筛选或汇总。本次**保持现有聚合逻辑不变**（所有 gameMode 混算平均正确率/时间），仅确保新 gameMode 的战绩能正确写入与读取。按 gameMode 分别排行作为后续迭代。

---

## 9. 数据模型变更（Postgres）

**无 schema 变更**。现有 `matches` 表的 `game_mode` 列已是 text/varchar，直接存 `'stroop'`/`'sequence'`/`'bottle'`。`user_stats` 聚合不区分 gameMode。

---

## 10. 测试策略

### 10.1 服务端单元测试

- 每个引擎：`generateSeed` 生成合法（序列无重复、瓶子 target≠initial、字色题目合法）、`applyAction` 正确判定、`finalize` 算分正确、`computePercent` 单调递增。
- `schulteEngine`：迁移现有 `schulteGame.test.ts`，补 direction（forward/reverse/random）用例。
- `registry`：四个 mode 都能取到引擎。

### 10.2 服务端集成测试（roomHandlers）

- 单局舒尔特：现有流程不回归。
- 单局字色：先完成者触发 grace，对方 10s 后强结束。
- 单局序列：双方都提交才结算；15s 超时强结束。
- 单局暗瓶：先排对者赢。
- 多局流程：选 [schulte, stroop]，打完舒尔特 → 收到 `room:nextRound` → gameMode 变 stroop → 打完 → `room:roundEnd`。
- reconfigure：本轮结束后房主改游戏 → gameQueue 重置。
- 断线：游戏中断线判负 + 多局推进。

### 10.3 前端

- 棋盘组件分派：四个 mode 都能渲染对应组件。
- 多局 UI：队列进度、nextRound/roundEnd 事件处理。
- 创建房间：单局/多局切换、游戏多选校验。

---

## 11. 迁移与发布

- 一次性发布（前后端同步），不做 `game:tap` → `game:action` 的兼容期。
- 部署步骤：后端先部署（新事件协议）→ 前端构建部署。短暂窗口期旧前端无法点击，可接受（PWA 已禁用 SW，用户刷新即新版）。
- 现有进行中的房间（内存态）在重启后丢失，无影响。

---

## 12. 未决 / 后续

- **按 gameMode 分别排行**：本次不做，混合统计。
- **快速匹配多游戏**：本次保持只舒尔特。
- **4–8 人房间**：架构留口（maxPlayers 已参数化），本次不实现。
- **断线重连恢复进度**：本次保持断线判负。
- **房主中途改游戏**：仅本轮结束后允许（reconfigure），进行中不可改。
