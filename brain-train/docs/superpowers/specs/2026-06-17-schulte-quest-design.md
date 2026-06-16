# 舒尔特闯关模式 Design Spec

**日期:** 2026-06-17
**状态:** Draft（待生成实现计划）
**作者:** DOKE + Claude（brainstorming session）
**影响范围:** `brain-train/` 子项目，仅舒尔特表游戏

---

## 1. 背景与现状

BrainTrain 当前提供 4 个独立训练游戏：舒尔特表、字色干扰、序列记忆、暗瓶排列。每个游戏都是"单局制"——玩家手动选难度，玩完看一个分数（满分 100）就结束。

**反馈维度只有三个：**得分、准确率、用时。

**长线目标仅有：**每日训练次数 + 连续打卡天数。

**已识别的"无聊"症状：**

- 玩家每局玩完只看到一个数字，**没有"我又变强了"或"差一点破纪录"的瞬间反馈**
- 难度由玩家手动选，**系统不自适应**，不会"逼"玩家挑战
- `ScoreBoard` 组件预留了 `streak`（连击）字段但**从未实际使用**
- 单局玩完即结束，缺乏长线目标和重玩动机
- 没有连击、没有破纪录提示、没有徽章/成就、没有等级经验、没有每日挑战、没有排行榜

## 2. 用户痛点与设计目标

用户在 brainstorming 中明确：游戏缺乏**单局肾上腺素 + 破纪录挑战 + 长期成就**这三层刺激。

**本设计的目标：** 在保持现有自由练习模式可用的前提下，为舒尔特表新增一套**Roguelike 风格的闯关 + Combo 系统**，提供：

- **单局紧张感**：Combo 连击 + 时间压力 + 多种规则变体
- **破纪录挑战**：10 关线性闯关，每关有星级目标
- **长期成就**：通关进度 + 星数累计（成就系统留待后续阶段）

**非目标（明确排除）：**

- 不动其他 3 个游戏（字色干扰 / 序列记忆 / 暗瓶排列）
- 不引入等级 / 经验值 / 段位（避免 RPG 化）
- 不引入社交 / 排行榜（单机体验）
- 不加入视觉干扰机制（如数字抖动、渐隐）

## 3. 范围

**In Scope:**

- 舒尔特表新增"闯关模式"入口与流程
- 10 关线性闯关，每关有预设难度配置
- Combo 连击系统（仅闯关模式启用）
- 星级评价（1/2/3 星）
- 闯关进度持久化（Dexie/IndexedDB）
- 关卡开始前的规则说明卡
- 胜利 / 失败 / 全通关庆典界面

**Out of Scope（明确不在本阶段做）:**

- 其他 3 个游戏的 Combo 改造
- 徽章 / 成就系统（留待后续）
- 每日挑战 / 限时活动（留待后续）
- 视觉干扰 / 道具系统
- 音效升级（仅复用现有 Howler 配置，不新增音效资产）

## 4. 核心机制

### 4.1 关卡矩阵（10 关，纯线性，无世界分组）

| 关 | 网格 | 方向 | 时限 | 命数 | 星级 combo 目标 |
|----|------|------|------|------|-----------------|
| 1  | 3×3  | 正向 | 无 | 3 命 | 8 |
| 2  | 4×4  | 正向 | 无 | 3 命 | 10 |
| 3  | 4×4  | 反向 | 无 | 3 命 | 12 |
| 4  | 5×5  | 正向 | 无 | 3 命 | 15 |
| 5  | 5×5  | 反向 | 5s/数字 | 3 命 | 18 |
| 6  | 5×5  | 正反交替 | 5s/数字 | 3 命 | 20 |
| 7  | 5×5  | 正反交替 | 4s/数字 | 2 命 | 22 |
| 8  | 6×6  | 正向 | 4s/数字 | 2 命 | 25 |
| 9  | 6×6  | 反向 | 3s/数字 | 1 命 | 28 |
| 10 | 6×6  | 混合 | 3s/数字 | 1 命 | 30 |

**难度变体引入节奏：**

- 第 3 关引入"反向"
- 第 5 关引入"时间限制"
- 第 6 关引入"正反交替"
- 第 7 关减命（3 命 → 2 命）
- 第 8 关增大网格（5×5 → 6×6）
- 第 9-10 关一击死亡（1 命）

**设计决策记录：**

- **网格最大 6×6**：6×6 = 36 个数字接近人眼视觉搜索极限，再大变成"找字游戏"而非"专注训练"
- **时间限制按"秒/数字"而非总时长**：5×5 的 30 秒 ≠ 6×6 的 30 秒，按"每数字 X 秒"更公平
- **命数渐进递减**：早期容错让玩家学习规则，后期一击死亡制造真正的紧张感
- **星级 combo 目标随关数线性增长**：从 8 → 30，给玩家明确的进步感

### 4.2 方向变体规则

- **正向（asc）**：从 1 点击到 N（N = gridSize²）
- **反向（desc）**：从 N 点击到 1
- **正反交替（alternate）**：1 → N → 2 → N-1 → 3 → N-2 → ...
- **混合（mixed）**：基于 `startTime` 作为确定性随机种子生成的固定排列

**`mixed` 序列生成算法（必须明确）：**

```typescript
// src/lib/schulteQuestConfig.ts
function mulberry32(seed: number) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function generateMixedSequence(gridSize: number, startTime: number): number[] {
  const N = gridSize * gridSize;
  const seed = startTime % 4294967296;       // 32-bit seed
  const rng = mulberry32(seed);
  const arr = Array.from({ length: N }, (_, i) => i + 1);
  // Fisher-Yates shuffle with seeded rng
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;                                // length N, unique 1..N
}
```

**关键属性：**

- 同一 `startTime` 总是生成相同序列（同一局内稳定）
- 不同 `startTime` 生成不同序列（玩家重玩时换新序列）
- 实现简单、可测试

**目标数字提示（所有方向变体通用）：**

参考现有 `Schulte.tsx` 第 138-142 行的"目标"指标，所有方向变体都显示**下一个目标数字**：

- `asc` / `desc`：玩家无需记忆，看提示即可
- `alternate`：每次点击后，"目标"指标更新为下一个交替数字（如点了 1 后显示 N，点了 N 后显示 2）
- `mixed`：关卡开始前 3 秒展示完整序列（数字依次高亮），之后只显示"下一个目标"

这避免玩家被"记序列"的认知负担压垮，把训练核心保持在"视觉搜索"上。

### 4.3 Combo 连击系统

**触发条件：** 连续正确点击数字（错误点击中断 combo）

**倍率曲线：**

| Combo 数 | 倍率 | 视觉反馈 |
|----------|------|----------|
| 0-4 | ×1.0 | 普通计分 |
| 5-9 | ×1.5 | 角落 combo 数字开始放大 |
| 10-19 | ×2.0 | 屏幕中央弹出"COMBO ×2!"，粒子效果 |
| 20-49 | ×3.0 | 屏幕边缘金光环绕 |
| 50+ | ×5.0 | 全屏闪光 |

**中断规则：** 错误点击 → combo **完全清零**（不减半，最严酷）

**跨关延续：** Combo 在**每关内独立计算**，不跨关延续（避免玩家为保 combo 而放弃高难关卡）

### 4.4 星级评价（每关最高 3 星）

三个条件**独立累加**，每达成一个加 1 星，最高封顶 3 星：

| 条件 | 加星 |
|------|------|
| 完成本关（通关） | +1 星（保底） |
| 最高 combo ≥ 本关 `comboTarget` | +1 星 |
| 全程零错误（errorCount = 0） | +1 星 |

**判定算法**（伪代码）：

```typescript
function computeStars(passed, maxCombo, errorCount, comboTarget): 0|1|2|3 {
  if (!passed) return 0;
  let stars = 1;                              // 通关保底 1 星
  if (maxCombo >= comboTarget) stars++;       // 连击 +1
  if (errorCount === 0) stars++;              // 完美 +1
  return stars;                               // 0-3
}
```

**注意：星数是数值（0/1/2/3），不绑定到具体的"第 N 颗星含义"。** UI 视觉上按数量填充（1 颗亮黄星 + 2 颗暗星），而不是按"通关星 / 连击星 / 完美星"分槽位。

**举例**：

| 通关 | combo 达标 | 零错误 | 星数 |
|------|------------|--------|------|
| ✅ | ✅ | ✅ | 3 |
| ✅ | ✅ | ❌ | 2 |
| ✅ | ❌ | ✅ | 2 |
| ✅ | ❌ | ❌ | 1 |
| ❌ | — | — | 0 |

**累积规则：**

- 每关保留**历史最高星数**（重玩不降级）
- `totalStars` 算法：`sum over levels of historical_max_stars[level]`
- 重玩获得更高星数时：`totalStars += newStars - oldStars`（差额累加）
- 重玩获得相同或更低星数时：`totalStars` 不变
- "重新闯关" / "重新挑战" **不清空星数**（保留历史最佳）

### 4.5 评分公式

```
本关得分 = (基础分 + 时间奖励) × Combo 倍率

基础分 = 100 × 关卡序号           // 第 1 关 100，第 10 关 1000
时间奖励 = 剩余秒数 × 5           // 仅有时限关卡，无时限关卡此项为 0
Combo 倍率 = 本关最高 combo 对应的倍率（≥ 1.0，永不 < 1）
```

**边界情况：**

- 玩家未通关（命数耗尽或超时）：**不调用评分公式**，本局无得分，`levelRecords[N]` 不更新
- 玩家通关但 maxCombo = 0（理论上不可能，至少点击第 1 个正确数字就 combo ≥ 1）：倍率按 ×1.0 兜底

**示例：** 第 5 关（5×5 反向，5s/数字，3 命，combo 目标 18）
- 基础分 = 100 × 5 = 500
- 假设剩余 10 秒 → 时间奖励 = 50
- 假设最高 combo = 18 → 倍率 ×2.0
- **本关得分 = (500 + 50) × 2.0 = 1100**

### 4.6 闯关得分与现有 0-100 分制的关系

**关键决策：闯关模式不写入 `trainingRecords`，避免破坏现有 0-100 分制统计。**

| 数据去向 | 自由模式 | 闯关模式 |
|----------|----------|----------|
| `trainingRecords` 表 | ✅ 写入（score 0-100） | ❌ 不写入 |
| `schulteQuestProgress.levelRecords[N]` | ❌ 不写入 | ✅ 写入（bestScore 原始值得） |
| `dailyGoals.completedSessions` | ✅ +1 / 次 | ✅ +1 / 次（整局结束算 1 次，不管通关几关） |
| `userProfile.totalSessions` | ✅ +1 / 次 | ✅ +1 / 次（与 dailyGoals 一致） |
| `userProfile.totalTrainingTime` | ✅ 累加用时 | ✅ 累加用时 |
| `Statistics.overall.totalSessions`（来自 `computeStatistics`） | ✅ 计入 | ⚠️ **不计入**（已知差异） |

**"一次训练"的定义：**

- **自由模式**：每次开始 → 完成 = 1 次训练
- **闯关模式**：进入第 1 关 → 失败/通关第 10 关/退出 = 1 次训练（不管中间通过几关）
- 闯关模式中"通关第 N 关" **不**算独立一次训练，避免与自由模式的概念混淆

**已知差异：** `computeStatistics()`（src/db/queries.ts:94-105 附近）基于 `trainingRecords` 表计算，由于闯关模式不写入该表，**闯关训练不会出现在统计页**。这是有意为之的隔离，避免污染 0-100 分制数据。如果未来需要在统计页展示闯关数据，应该单独加一个 `computeQuestStatistics()` 函数，而不是修改现有 `computeStatistics`。

## 5. 用户流程

### 5.1 入口流程

```
点击舒尔特卡片
   ↓
进入舒尔特页面（两个按钮）
   ↓
┌────────────────┐    ┌────────────────┐
│   自由练习     │    │   闯关模式     │
└────────────────┘    └────────────────┘
                            ↓
                    [有进度?]
                       是 → 弹窗：
                            ┌──────────────────────────┐
                            │ 当前进度：第 5 关          │
                            │ 累计星星：7/30 ⭐          │
                            │                           │
                            │ [继续闯关]   [重新闯关]   │
                            └──────────────────────────┘
                       否 → 直接进入第 1 关前的规则说明
                            ↓
                    规则说明卡 → [开始] → 进入游戏
```

### 5.2 关卡内循环

```
关卡开始（显示规则说明卡）
   ↓
[开始] → 游戏运行（HUD 显示关卡号 / 时限 / 命数 / combo）
   ↓
[通关] → 计算星级和得分 → 写入 levelRecords[N] → clearedLevel 更新
   ↓
N+1 ≤ 10 → 自动进入第 N+1 关规则说明
N+1 > 10 → 全通关庆典页

[失败] → 弹窗 "💥 重新闯关" → [重试本关] [退出]
   ↓
[重试本关] → 回到当前关的规则说明卡
[退出] → 保存 inProgressLevel = N → 回入口

[手动暂停退出] → 保存 inProgressLevel = N → 回入口
```

### 5.3 "继续闯关"的语义与 inProgressLevel 持久化时机

**`inProgressLevel` 写入时机（必须明确）：**

| 时机 | 操作 |
|------|------|
| 进入第 N 关的**规则说明卡**时 | 立即写入 `inProgressLevel = N`（不等玩家点"开始"） |
| 第 N 关通关，进入第 N+1 关规则说明卡时 | 写入 `inProgressLevel = N+1`，同时 `clearedLevel = max(clearedLevel, N)` |
| 第 N 关失败，玩家点"重试本关"时 | `inProgressLevel` 不变（仍是 N） |
| 第 N 关失败，玩家点"退出"时 | `inProgressLevel` 不变（仍是 N） |
| 玩家手动暂停并退出时 | `inProgressLevel` 不变（仍是 N） |
| 玩家主动选择"重新闯关"时 | `inProgressLevel = 1`，`clearedLevel` 不变，`levelRecords` 保留 |
| 全通关后选"重新挑战"时 | 与"重新闯关"相同：`inProgressLevel = 1`，`clearedLevel` 不变（保留全部通关状态），`levelRecords` 保留所有星数 |
| 第 10 关通关时 | `inProgressLevel = undefined`，`clearedLevel = 10` |

**关键决策：** `inProgressLevel` 在关卡规则说明卡显示时立即持久化，**不**等到游戏开始后。这保证即使应用在游戏过程中崩溃/被杀，下次"继续闯关"也能回到正确的关。

**游戏状态不持久化：**

- 玩家在第 N 关游戏中点击了 5 个数字后退出 → 这 5 次点击的进度**不保留**
- 下次"继续闯关" → 重新看规则说明卡 → 重新开始第 N 关

**`inProgressLevel === undefined` 的场景：**

- 玩家从未玩过闯关模式（首次进入）
- 玩家已全部通关（clearedLevel === 10）

入口弹窗逻辑（统一基于 `inProgressLevel`）：

```typescript
function getEntryView(progress: SchulteQuestProgress | null): EntryView {
  if (!progress || (!progress.inProgressLevel && progress.clearedLevel === 0)) {
    return { type: 'FRESH_START' };                 // 直接进入第 1 关
  }
  if (progress.clearedLevel === 10 && !progress.inProgressLevel) {
    return { type: 'COMPLETED', totalStars: progress.totalStars };
    // 显示"全部通关"弹窗，按钮："重新挑战"
  }
  return {
    type: 'CONTINUE_OR_RESTART',
    inProgressLevel: progress.inProgressLevel!,
    clearedLevel: progress.clearedLevel,
    totalStars: progress.totalStars,
  };
}
```

**关键判断：** 弹窗类型由 `inProgressLevel + clearedLevel` 联合决定，不依赖单独字段。

### 5.4 "重新闯关"的语义

- 玩家主动选择"重新闯关" → 从第 1 关开始
- `clearedLevel` 和 `levelRecords` **保留**（不丢历史星数）
- `inProgressLevel` 清空

## 6. 数据结构变更

### 6.1 扩展 `SchulteDetails`（types/index.ts）

`SchulteDetails` 当前是 `TrainingDetails` 联合类型的一员（types/index.ts:77），扩展时把 `mode` 设为**可辨识联合标签**：

```typescript
export interface SchulteDetails {
  mode: 'quest' | 'free';            // 必填，作为 discriminated tag
  level?: number;                    // 闯关模式有
  gridSize: 3 | 4 | 5 | 6;           // 扩展：加入 6
  order: 'asc' | 'desc' | 'alternate' | 'mixed';  // 扩展
  completionTime: number;
  errorCount: number;
  clickSequence: number[];
  maxCombo: number;                  // 新增
  livesUsed?: number;                // 新增：仅闯关
  timeLimitPerNumber?: number;       // 新增：仅有时限
  stars?: 1 | 2 | 3;                 // 新增：仅闯关
}
```

**TypeScript 兼容性策略：**

由于 `mode` 是必填字段，旧数据读取时需要类型守卫。新建 `src/lib/normalizeDetails.ts`：

```typescript
export function normalizeSchulteDetails(raw: any): SchulteDetails {
  if (raw.mode) return raw;
  return {
    ...raw,
    mode: 'free' as const,
    maxCombo: 0,                     // 旧数据无 combo 信息
  };
}
```

**必须包装的读取点（所有从数据库读取 SchulteDetails 的地方）：**

| 文件 | 函数 | 改动 |
|------|------|------|
| `src/db/queries.ts` | `getTrainingRecords` | 在 `filter(r => r.mode === 'schulte')` 后 map 包装 |
| `src/db/queries.ts` | `getTrainingRecordById` | 返回前包装 |
| `src/db/queries.ts` | `getTodayTrainingRecords` | 同上 |
| `src/db/queries.ts` | `computeStatistics` | 在累加 schulte 记录前包装 |
| `src/pages/Stats.tsx` | 渲染时 | 通过 queries 已包装，无需重复 |
| `src/pages/Insights.tsx` | 同上 | 无需重复 |

**`SchulteDetails` 内部模式分支：**

- `mode: 'free'`：仅 `gridSize` / `order` / `completionTime` / `errorCount` / `clickSequence` / `maxCombo`（始终为 0）有值
- `mode: 'quest'`：所有字段可能有值

类型层不强制约束（保持单一 interface + 运行时判断），避免侵入式重构 `TrainingDetails` 联合类型。

### 6.2 新增类型

```typescript
// 关卡配置（写死的常量，不入库）
export interface SchulteQuestLevelConfig {
  level: number;                     // 1-10
  gridSize: 3 | 4 | 5 | 6;
  direction: 'asc' | 'desc' | 'alternate' | 'mixed';
  timeLimitPerNumber?: number;       // 秒，undefined = 无时限
  lives: 1 | 2 | 3;
  comboTarget: number;
}

// 玩家进度（入库，单条记录）
export interface SchulteQuestProgress {
  clearedLevel: number;              // 已通关的最高关（0-10），0 表示一关都没过
  totalStars: number;                // 累计星数（0-30）
  inProgressLevel?: number;          // 暂停退出时未完成的关（clearedLevel + 1）
  levelRecords: Record<number, {     // 仅已通关的关有记录
    stars: 1 | 2 | 3;
    bestScore: number;
    bestCombo: number;
    bestTime: number;
  }>;
}
```

### 6.3 Dexie 数据库扩展

新增表 `schulteQuestProgress`。文件位置：`src/db/index.ts`（当前 v2，新增 v3）。

```typescript
// src/db/index.ts
import type { SchulteQuestProgress } from '../types';

export class BrainTrainDB extends Dexie {
  userProfile!: Table<UserProfile>;
  trainingRecords!: Table<TrainingRecord>;
  dailyGoals!: Table<DailyGoal>;
  schulteQuestProgress!: Table<SchulteQuestProgress>;  // 新增

  constructor() {
    super('BrainTrainDB');
    this.version(1).stores({ /* ... */ });
    this.version(2).stores({ /* ... */ }).upgrade(/* ... */);

    // v3: 新增舒尔特闯关进度表
    this.version(3).stores({
      userProfile: 'id',
      trainingRecords: 'id, mode, startedAt, [mode+startedAt]',
      dailyGoals: 'date',
      schulteQuestProgress: 'id',     // 单条记录，id 固定为 'singleton'
    });
  }
}
```

**关键说明：**

- **当前版本是 v2**（src/db/index.ts:18），新增必须是 v3
- 现有 3 张表的索引 schema **保持不变**
- `trainingRecords` 表 schema 不需要改：`mode` 字段是 `TrainingDetails` 内部的子字段（运行时数据），不是顶层索引
- `schulteQuestProgress` 表只有 1 条记录（id = `'singleton'`），用 `put` 而非 `add`
- 无需 `upgrade()` 回调：新表无历史数据需要迁移

## 7. UI/UX 设计

### 7.1 入口（舒尔特页面）

```
┌──────────────────────────────┐
│         舒尔特表              │
│                               │
│    ┌─────────────────────┐   │
│    │     自由练习        │   │
│    │  5×5 网格 · 无压力   │   │
│    └─────────────────────┘   │
│                               │
│    ┌─────────────────────┐   │
│    │   闯关模式          │   │
│    │  当前进度：第 5 关   │   │
│    │  ⭐ 7/30            │   │
│    └─────────────────────┘   │
└──────────────────────────────┘
```

### 7.2 关卡开始前 · 规则说明卡

```
┌──────────────────────────────┐
│         第 5 关               │
│                               │
│  网格：5×5                    │
│  方向：反向（25→1）           │
│  时限：每数字 5 秒            │
│  命数：3 命                   │
│                               │
│  ⭐ 通关                      │
│  ⭐⭐ combo ≥ 18              │
│  ⭐⭐⭐ 零错误                │
│                               │
│         [ 开始 ]              │
└──────────────────────────────┘
```

### 7.3 关卡内 HUD

```
┌──────────────────────────────┐
│ L5 · 反向    ⏱ 23s     ❤❤❤ │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                               │
│           COMBO               │
│            ×12                │
│                               │
│      [  5×5 舒尔特网格  ]     │
│                               │
│            ⏸ 暂停             │
└──────────────────────────────┘
```

- 顶部左：关卡号 + 方向
- 顶部中：剩余时间条（仅有时限关卡显示）
- 顶部右：命数（❤ 图标）
- 中部上：combo 显示（达到 milestone 时弹出动画）
- 中部下：舒尔特网格
- 底部：暂停按钮

### 7.4 通关弹窗

```
┌──────────────────────────────┐
│         🎉 通关！             │
│                               │
│       ⭐  ⭐  ⭐               │
│                               │
│    得分：1100                 │
│    最高 combo：×18            │
│    用时：47s                  │
│                               │
│   [下一关]    [重玩]          │
└──────────────────────────────┘
```

**按钮语义：**

- `[下一关]`：进入第 N+1 关规则说明卡（若 N=10，进入全通关庆典）
- `[重玩]`：重玩**当前关**（不修改 `clearedLevel`，按 §4.4 规则保留历史最高星数）
- 第 10 关通关时无"下一关"按钮，只有"重玩"和"返回主页"

### 7.5 失败弹窗

```
┌──────────────────────────────┐
│         💥 失败               │
│                               │
│    关卡进度：18/25            │
│    最高 combo：×6             │
│                               │
│    [重试本关]    [退出]       │
└──────────────────────────────┘
```

### 7.6 全通关庆典

```
┌──────────────────────────────┐
│      🏆 全部通关！            │
│                               │
│   总星数：⭐ 28/30            │
│   总用时：12 分 34 秒         │
│                               │
│    [重新挑战]                 │
└──────────────────────────────┘
```

## 8. 与现有代码的集成点

| 文件 | 改动类型 | 改动内容 |
|------|----------|----------|
| `src/types/index.ts` | 修改 | 扩展 `SchulteDetails`（加 `mode` discriminated tag），新增 `SchulteQuestLevelConfig` / `SchulteQuestProgress` |
| `src/db/index.ts` | 修改 | 新增 v3 schema，加 `schulteQuestProgress` 表（注意：当前文件叫 `index.ts` 不是 `schema.ts`） |
| `src/db/queries.ts` | 修改 | 加 `getQuestProgress` / `saveQuestProgress` / `normalizeSchulteDetails`（旧数据兜底） |
| `src/pages/games/Schulte.tsx` | 重构 | mode 选择（自由/闯关）+ 闯关路由（当前文件硬编码 `GRID_SIZE=5` `GRID_ORDER='asc'`，第 13-14 行，需要参数化） |
| `src/components/game/SchulteGrid.tsx` | **重大重构** | 当前文件第 12 行 `GRID_SIZE = 5` 是模块级常量，需要改为接受 `gridSize` 和 `order` props；加 `onComboChange` / `onLifeLost` / `onTimeExpired` 钩子（自由模式默认值兼容） |
| `src/components/game/QuestLevelIntro.tsx` | **新建** | 关卡规则说明卡 |
| `src/components/game/QuestHUD.tsx` | **新建** | 闯关模式顶部 HUD（关卡/时限/命数/combo） |
| `src/components/game/QuestResultDialog.tsx` | **新建** | 通关 / 失败 / 全通关弹窗 |
| `src/lib/schulteQuestConfig.ts` | **新建** | 10 关配置常量 + 倍率表 + `computeStars` / `computeScore` 工具函数 |
| `src/lib/gameplayInstructions.ts` | 修改 | 加入闯关模式说明 |
| `src/components/game/index.ts` | 修改 | 导出新组件 |

**`SchulteGrid` 重构的具体改动（重要）：**

当前签名（src/components/game/SchulteGrid.tsx:14）：

```typescript
export function SchulteGrid({
  order,                            // 'asc' | 'desc'
  onCorrectClick,
  onWrongClick,
  onComplete,
  isActive,
  startTime
}: SchulteGridProps)
```

目标签名：

```typescript
export function SchulteGrid({
  gridSize,                         // 新增：3 | 4 | 5 | 6（替代模块级 GRID_SIZE）
  order,                            // 扩展：'asc' | 'desc' | 'alternate' | 'mixed'
  expectedSequence?,                // 新增：mixed 模式预设序列
  onCorrectClick,
  onWrongClick,
  onComboChange?,                   // 新增：combo 变化回调（参数：当前 combo 数）
  onComplete,
  isActive,
  startTime
}: SchulteGridProps)
```

**职责分工（重要）：**

| 关注点 | 负责方 | 说明 |
|--------|--------|------|
| 网格渲染 + 点击检测 | `SchulteGrid` 内部 | 接收 `gridSize` / `order` / `expectedSequence` |
| Combo 计数 | `SchulteGrid` 内部 | 连续正确点击累加，错误清零；通过 `onComboChange` 通知父组件 |
| 命数管理 | **父组件**（`Schulte.tsx` 或新的 QuestGamePage） | 通过 `onWrongClick` 接收错误通知，自己扣命 |
| 时间管理 | **父组件** | 父组件持有计时器，超时设 `isActive=false` |
| 失败判定（lives === 0 或 超时） | **父组件** | 父组件渲染失败弹窗 |
| 成功判定（点击完所有数字） | `SchulteGrid` 内部 | 通过 `onComplete` 通知父组件 |

**网格内部不知道命数 / 时限的概念**，只负责"点击检测 + combo 计算"。这样 `SchulteGrid` 保持单一职责，闯关逻辑集中在父组件。

**向后兼容：** 自由模式调用时，`gridSize = 5` `order = 'asc'`，其他可选回调传入空函数或不传。父组件忽略 combo 信息即可。

## 9. 验证标准

### 9.1 功能验证

- [ ] 入口：点击舒尔特卡片，可见"自由练习"和"闯关模式"两个按钮
- [ ] 无进度时点"闯关模式"，直接进入第 1 关规则说明
- [ ] 有进度时点"闯关模式"，弹窗显示进度和"继续 / 重新闯关"
- [ ] 通关第 N 关后自动进入第 N+1 关规则说明
- [ ] 通关第 10 关后显示全通关庆典
- [ ] 失败后弹窗提供"重试本关"和"退出"
- [ ] 中途退出后下次进入可"继续闯关"
- [ ] 关卡数据持久化：刷新页面后进度仍在

### 9.2 Combo 系统

- [ ] 连续正确点击增加 combo
- [ ] 错误点击清零 combo，扣 1 命
- [ ] Combo 达到 5/10/20/50 时分别显示对应倍率和动画
- [ ] Combo 数和倍率正确按公式计算得分

### 9.3 星级评价

- [ ] 通关后正确计算 1/2/3 星
- [ ] 重玩获得更高星数时更新记录（不降级）
- [ ] 总星数累加正确

### 9.4 向后兼容

- [ ] 旧训练记录可正常读取（mode 默认按 `free`）
- [ ] 自由练习模式功能完全不受影响
- [ ] 其他 3 个游戏完全不受影响

### 9.5 UI/动画

- [ ] Combo 触发里程碑时有视觉反馈（粒子 / 闪光）
- [ ] 错误时屏幕震动 / 红色闪烁
- [ ] 时间条在剩余 < 25% 时变红色
- [ ] 命数减少时图标动画

## 10. 后续阶段（不在本设计内）

本设计为"刺激感改造"的第一阶段。后续可能的方向：

- **阶段 2：破纪录挑战** — 每日挑战 + 个人最佳记录可视化
- **阶段 3：成就系统** — 徽章、称号、稀有皮肤
- **阶段 4：扩展到其他游戏** — 字色干扰、序列记忆、暗瓶排列也加入 Combo + 闯关
- **阶段 5：音效升级** — Combo 升调、里程碑庆祝音

这些阶段独立设计，不阻塞本阶段的实现。

## 11. 风险与权衡

| 风险 | 缓解 |
|------|------|
| Combo 清零太狠，挫败感重 | 早期关卡（1-4）无时限、3 命，给玩家学习空间 |
| 6×6 网格在小屏（手机）上字太小 | 使用响应式字号，必要时缩放整个网格容器 |
| 失败重试当前关可能导致卡关 | 玩家随时可"退出" → "重新闯关"从第 1 关开始 |
| 旧训练记录兼容性 | `mode` 字段读取时按 `free` 兜底，无需迁移；详细策略见 §6.1 |
| 关卡 10 "混合方向"实现复杂 | 用 `startTime` 作为确定性随机种子，关卡开始前 3 秒高亮展示完整序列 |
| `SchulteGrid` 重构影响自由模式 | 重构后自由模式调用方式参数化（gridSize=5, order='asc'），保证现有 Schulte.tsx 不破坏 |
| 闯关得分污染现有 0-100 分制统计 | 闯关模式不写入 `trainingRecords`，只入 `schulteQuestProgress`（见 §4.6） |
| 应用崩溃丢失关卡进度 | 进入规则说明卡时立即写 `inProgressLevel`（见 §5.3） |

---

**Next Step:** 调用 `superpowers:writing-plans` skill，将本设计转化为可执行的实现计划。
