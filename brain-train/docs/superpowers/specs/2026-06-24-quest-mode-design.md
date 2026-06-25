# 主线闯关模式设计（Quest Mode）

- **日期**：2026-06-24
- **状态**：待实现
- **范围**：在现有「自由训练」之外新增「主线闯关」入口，把 4 个小游戏（舒尔特 / 序列记忆 / Stroop / 暗瓶排列）随机串联成一条由易到难的线性闯关路线

## 1. 背景与目标

### 1.1 问题

- 暗瓶排列下排灰瓶无信息承载功能，纯占位，应删除。
- 现有 4 个游戏各自独立，缺乏跨游戏的「目标感 / 过程刺激 / 变化」牵引。
- 用户明确暂无完整剧情文案，需从简起步，后续可扩展。

### 1.2 目标

- 用一条线性闯关主线串联 4 个游戏，由易到难，提供目标感与收集感。
- 首页双大卡入口：主线闯关 + 自由训练（自由训练现状零改动）。
- 暗瓶删除无用的下排灰瓶。
- 为 Sequence / Stroop 补充难度维度，使 10 级之间有可感知的变化。
- 架构为后续加剧情/分支留好扩展点（本阶段不做）。

### 1.3 非目标（本阶段不做）

- 分支叙事、多结局、交互式文字剧情引擎。
- 完整剧情文案编写。
- 新增小游戏。

## 2. 总体架构

```
首页 (App.tsx)
 ├─ 主线闯关卡  ──→ /quest (Quest.tsx)
 │                  ├─ QuestHub: 4 游戏进度总览 + 开始下一关
 │                  ├─ QuestSession: 抽游戏 → 渲染对应 Runner → 回报结果
 │                  └─ QuestResultDialog: 星级 + 继续下一关 / 返回大厅
 └─ 自由训练卡  ──→ /games (现有 4 游戏，原样不动)
```

核心数据流：
1. Hub 读存档（`QuestProgress`）。
2. 玩家点「开始下一关」→ `pickNextGame(progress)` 抽游戏 → `nextDifficulty = progress[g] + 1`。
3. QuestSession 渲染对应 Runner，传入难度参数（来自该游戏的 10 级难度表）。
4. 游戏完成 → 回报 `QuestResult` → `applyResult(progress, result)` 更新存档。
5. 若 4 个全满 → 通关结算；否则返回 Hub 或连玩下一关。

## 3. 抽游戏算法

纯函数，可单测，不依赖 React 状态。

```
输入: progress = { schulte: 0..10, sequence: 0..10, stroop: 0..10, bottle: 0..10 }
输出: GameId | null

1. candidates = { g | progress[g] < 10 }            // 没推满的
2. 若 candidates 为空 → 返回 null（已通关）
3. nextDifficulty(g) = progress[g] + 1
4. minNext = min(nextDifficulty(g) for g in candidates)
5. eligible = { g in candidates | nextDifficulty(g) - minNext < 3 }
6. 从 eligible 中均匀随机抽一个返回
```

### 3.1 关键性质（对应单测用例）

- 全 0 时，4 个都 eligible，任一可抽。
- 舒尔特冒进到 progress=5、其他为 0：舒 nextDiff=6，minNext=1，6−1=5，5<3 为假 → 舒被锁，必抽其他三个。
- 某游戏 progress=10 → 永不在 candidates。
- 全满 → null（触发通关结算）。
- 连撞上限：最坏连抽同一游戏 3 次（第 4 次 diff 达 3 被锁）。

## 4. 难度参数表（4 游戏 × 10 级）

每游戏 10 级，每级携带参数 + 星级阈值（`goodThreshold` / `excellentThreshold`，具体含义随游戏类型而异）。

### 4.1 Schulte 舒尔特

| 难度 | gridSize | direction | timeLimit/数 | lives |
|---|---|---|---|---|
| 1 | 3 | asc | — | 3 |
| 2 | 4 | asc | — | 3 |
| 3 | 4 | desc | — | 3 |
| 4 | 5 | asc | — | 3 |
| 5 | 5 | desc | 5s | 3 |
| 6 | 5 | alternate | 6s | 3 |
| 7 | 5 | alternate | 5s | 2 |
| 8 | 6 | desc | 4s | 2 |
| 9 | 6 | mixed | 3s | 2 |
| 10 | 6 | mixed | 3s | 1 |

星级：复用现有 `computeStars({passed, maxCombo, errorCount, comboTarget})`。
- 2 星：maxCombo ≥ comboTarget
- 3 星：maxCombo ≥ comboTarget 且 errorCount = 0

### 4.2 Sequence 序列记忆

| 难度 | sequenceLength | 展示 | distractors |
|---|---|---|---|
| 1 | 4 | step | 0 |
| 2 | 5 | step | 0 |
| 3 | 6 | step | 0 |
| 4 | 6 | flash | 0 |
| 5 | 7 | flash | 0 |
| 6 | 7 | flash | 1 |
| 7 | 8 | flash | 2 |
| 8 | 9 | flash | 2 |
| 9 | 10 | flash | 3 |
| 10 | 10 | flash | 3 + 限时回答 |

新机制：
- **distractors**：序列展示完毕后，棋盘额外亮起 N 个错误位置作干扰，玩家须分辨真假。
- **displayMode**：`step`（逐个亮起，易记）vs `flash`（整段闪现，难记）。
- **answerTimeLimit**：难度 10 起限定玩家回答时长（展示结束后开始倒计时）。

星级（准确率 = positionAccuracy 60% + itemAccuracy 40%）：
- 2 星：准确率 ≥ 80%
- 3 星：准确率 ≥ 95%

### 4.3 Stroop 斯特鲁普

| 难度 | questionCount | mode |
|---|---|---|
| 1 | 10 | standard |
| 2 | 12 | standard |
| 3 | 15 | standard |
| 4 | 15 | reverse |
| 5 | 15 | dual |
| 6 | 18 | dual |
| 7 | 20 | dual |
| 8 | 20 | dual + 限时/题 |
| 9 | 20 | dual + 严苛限时 |
| 10 | 20 | dual + 极限限时 |

新机制：
- **mode**：`standard`（字意 vs 颜色冲突）/ `reverse`（反向判断——选颜色名而非颜色）/ `dual`（混合两种规则）。
- **timePerQuestion**：每题作答时间上限秒数（难度 8 起，严苛 3s，极限 2s）。

星级（准确率 = correctCount / questionCount）：
- 2 星：准确率 ≥ 80%
- 3 星：准确率 ≥ 95%

### 4.4 Bottle 暗瓶排列

| 难度 | bottleCount | timeLimit |
|---|---|---|
| 1 | 4 | — |
| 2 | 5 | — |
| 3 | 6 | — |
| 4 | 6 | 90s |
| 5 | 7 | 90s |
| 6 | 7 | 60s |
| 7 | 8 | 60s |
| 8 | 8 | 45s |
| 9 | 9 | 45s |
| 10 | 9 | 30s |

改动：
- **删除下排灰瓶**（原有装饰，无信息承载）。仅保留上排彩色瓶 + 顶部 matchCount 反馈。
- **timeLimit**：限时压力（难度 4 起）。

星级（swaps = 玩家用交换次数，optimal = `computeOptimalSwaps`）：
- 2 星：swaps ≤ optimal × 1.5
- 3 星：swaps = optimal

### 4.5 星级判定统一规则

- **1 星**：完成（保底）。
- **2 星**：达到该游戏该难度的 `goodThreshold`。
- **3 星**：达到 `excellentThreshold`。
- 每级难度的阈值由难度表项携带。

## 5. 存档模型

### 5.1 数据结构

```ts
type GameId = 'schulte' | 'sequence' | 'stroop' | 'bottle';

interface QuestProgress {
  progress: Record<GameId, 0..10>;   // 各游戏已完成的最高难度
  stars: Record<string, 0 | 1 | 2 | 3>; // key = `${gameId}-${difficulty}`
  completed: boolean;                 // 4 游戏全满
}
```

### 5.2 存储位置

复用现有 IndexedDB 层（`src/db/queries.ts`），新增独立 key `quest-progress-v1`。不触碰舒尔特闯关现有存档 key。

### 5.3 更新规则

- 完成一关 → `progress[g] = max(progress[g], difficulty)`（防回退）。
- `stars[key] = max(stars[key], newStars)`（只留最好）。
- 4 个 progress 都 = 10 → `completed = true`。

### 5.4 重玩已通过关卡

允许重玩刷星。重玩只更新 stars（取 max），不改 progress（不回退、不因重玩低难度异常推进）。

### 5.5 退出与中断

- 进行中退出 → 确认对话框 → 不存档（这关不算完成）→ 回 Hub。
- 存档即时：每关完成后立即写 IndexedDB。

## 6. 游戏组件接入（适配器层）

### 6.1 原则

原游戏组件一行不改 → 新增 Runner 适配器组件包裹。但 Sequence / Stroop / Bottle 需要纯增量增强（加可选 prop，不传时走默认值，自由模式零回归）。

### 6.2 QuestResult 统一接口

```ts
interface QuestResult {
  gameId: GameId;
  difficulty: number;       // 1-10
  passed: true;             // 完成即推进，恒 true（退出不算）
  stars: 0 | 1 | 2 | 3;
  score: number;            // 原始分，仅展示
  details: Record<string, unknown>;
}
```

### 6.3 Runner 职责

1. 接收 `{ difficulty }`，查难度参数表翻译成原组件参数。
2. 渲染原组件，把参数喂进去。
3. 监听原组件完成回调，翻译成 `QuestResult`。
4. 调用主线 `onQuestComplete(questResult)`。

### 6.4 原组件增强清单

| 组件 | 新增 prop | 默认值（自由模式行为） |
|---|---|---|
| `SequenceGame` | `distractors?: number`、`displayMode?: 'step' \| 'flash'`、`answerTimeLimit?: number` | 0 / step / undefined（无限制） |
| `StroopGame` | `mode?: 'standard' \| 'reverse' \| 'dual'`、`timePerQuestion?: number`、`onComplete?` | standard / undefined（无限制）/ 内部闭环 |
| `BottleGame` | `timeLimit?: number` | undefined（无限制）+ 删下排 JSX |

`SchulteGrid` 无需改动（现有 `gridSize` / `direction` / `timeLimitPerNumber` / `lives` / `onComplete(combo, errors, time)` 已覆盖全部 10 级参数）。

### 6.5 Runner 完成回调翻译

| Runner | 监听原组件回调 | 翻译为 QuestResult |
|---|---|---|
| Schulte | `onComplete(combo, errors, time)` | stars = `computeStars(...)`，score 由 `computeScore` |
| Sequence | `onComplete({positionAccuracy, itemAccuracy})` | 准确率 = position×0.6 + item×0.4 → 星级阈值 |
| Stroop | `onComplete({correctCount, questionCount})` | 准确率 = correct/count → 星级阈值 |
| Bottle | `onComplete(swaps, optimal)` | 星级看 swaps vs optimal |

## 7. 页面结构与 UX

### 7.1 首页（App.tsx）

- 双大卡：主线闯关（显示进度 X/40 + 继续/开始按钮）+ 自由训练（进入现有 4 游戏列表）。
- 自由训练卡现状零改动。

### 7.2 Hub 视图（关卡大厅）

- 4 游戏各自的进度条 + 星级（已通过关卡显示最好星数）。
- 主按钮「开始下一关」→ `pickNextGame` → 直接切入抽到的游戏（不预告）。
- 已通过关卡可点击重玩刷星。

### 7.3 游戏进行中

- 全屏渲染对应游戏（经 Runner 适配器）。
- 顶部极简 QuestHUD：当前游戏名 + 难度 + 退出按钮。

### 7.4 结算（QuestResultDialog）

- 星级动画（逐颗点亮）。
- 「继续下一关」直接抽下一关（连玩节奏，不回 Hub）。
- 「返回大厅」回 Hub。
- 4 个全满 → 通关结算（庆祝页 + 继续刷星选项）。

### 7.5 关卡预告

不预告直接进入抽到的游戏（节奏最快）。

## 8. 文件清单

### 8.1 新增

| 文件 | 职责 |
|---|---|
| `src/lib/questGameConfig.ts` | 4 游戏 10 级难度表 + 星级阈值 |
| `src/lib/questEngine.ts` | `pickNextGame` / `applyResult` / `isCleared` 纯逻辑 |
| `src/components/quest/QuestSchulteRunner.tsx` | Schulte 适配器 |
| `src/components/quest/QuestSequenceRunner.tsx` | Sequence 适配器 |
| `src/components/quest/QuestStroopRunner.tsx` | Stroop 适配器 |
| `src/components/quest/QuestBottleRunner.tsx` | Bottle 适配器 |
| `src/components/quest/QuestRunner.tsx` | 按 gameId 分发 |
| `src/components/quest/QuestHub.tsx` | 关卡大厅 |
| `src/components/quest/QuestHUD.tsx` | 进行中顶部条 |
| `src/components/quest/QuestResultDialog.tsx` | 结算弹窗 |
| `src/pages/Quest.tsx` | 主线页面（Hub ↔ Session ↔ Result 状态机） |
| `src/lib/questEngine.test.ts` | 算法单测 |
| `src/lib/questGameConfig.test.ts` | 难度表完整性测试 |

### 8.2 改动

| 文件 | 改动 |
|---|---|
| `src/App.tsx` | 首页改双大卡入口 |
| `src/pages/games/Sequence.tsx` | 透传 `distractors` |
| `src/pages/games/Stroop.tsx` | 透传 `mode` + 暴露 `onComplete` |
| `src/pages/games/Bottle.tsx` | 透传 `timeLimit` + 删下排 |
| `src/components/game/SequenceGame.tsx` | 加 `distractors` prop 实现 |
| `src/components/game/StroopGame.tsx` | 加 `mode` prop + `onComplete` |
| `src/components/game/BottleGame.tsx` | 加 `timeLimit` prop + 删下排 JSX |
| `src/db/queries.ts` | 新增 `getQuest/saveQuest`（独立 key） |
| `src/types.ts` | 新增 QuestProgress / QuestResult / GameId 类型 |

## 9. 测试策略

### 9.1 纯逻辑（必测）

- `questEngine.test.ts`：`pickNextGame` 全部边界（全 0 / 冒进锁定 / 推满移除 / 全满 null / 连撞 ≤ 3）、`applyResult` 更新规则、`isCleared`。
- `questGameConfig.test.ts`：4 张难度表各 10 项完整、参数单调合理、阈值存在。
- 复用现有 `bottleUtils.test.ts` 的 `computeOptimalSwaps` 给 Bottle 星级托底。

### 9.2 集成（手测）

- 自由模式 4 游戏零回归。
- 主线从 0 关玩到通关全流程。
- 重玩刷星、中断不存档、退出再进进度还在。

### 9.3 不做

- UI 组件快照测试（保持与项目现有测试体系一致）。

## 10. 扩展点（本阶段不做，留口）

- **剧情点缀**：难度表项预留可选 `narrative?: string` 字段，后续填文案即生效。
- **分支叙事**：关卡完成后可加 `forks` 字段，架构可演进为分支图。
- **新游戏**：`GameId` 联合类型可扩展，新游戏加自己的难度表 + Runner 即可接入主线。
