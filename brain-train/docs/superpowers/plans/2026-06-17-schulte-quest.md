# 舒尔特闯关模式 Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 BrainTrain 的舒尔特表游戏中新增 Roguelike 风格的闯关模式，包含 10 关线性闯关、Combo 连击系统、星级评价和 Dexie 持久化。

**Architecture:** 三层架构：① 类型与工具函数层（types + lib/schulteQuestConfig）；② 数据库层（Dexie v3 + 旧数据兼容）；③ UI 层（SchulteGrid 重构 + 3 个新组件 + Schulte.tsx 状态机）。SchulteGrid 保持单一职责（只管点击检测 + combo），闯关逻辑（命数/时限/状态机）集中在 Schulte.tsx 父组件。

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Tailwind CSS 4, Framer Motion, Dexie.js 4.4, Vitest 4 + Testing Library, Zustand

**Spec:** `brain-train/docs/superpowers/specs/2026-06-17-schulte-quest-design.md`

---

## File Structure

| 操作 | 文件路径 | 职责 |
|------|---------|------|
| 修改 | `src/types/index.ts` | 扩展 `SchulteDetails`（加 `mode` discriminated tag），新增 `SchulteQuestLevelConfig` / `SchulteQuestProgress` |
| 新建 | `src/lib/schulteQuestConfig.ts` | 10 关配置常量 + 倍率表 + `computeStars` / `computeScore` / `generateMixedSequence` / `mulberry32` |
| 新建 | `src/lib/normalizeDetails.ts` | `normalizeSchulteDetails`（旧数据兜底为 `mode: 'free'`） |
| 修改 | `src/db/index.ts` | Dexie 加 v3 schema 和 `schulteQuestProgress` 表 |
| 修改 | `src/db/queries.ts` | 加 `getQuestProgress` / `saveQuestProgress`，所有读取 schulte 记录处包装 normalize |
| 修改 | `src/components/game/SchulteGrid.tsx` | 接受 `gridSize` / `order` / `expectedSequence` / `onComboChange` props，内部维护 combo 状态 |
| 修改 | `src/pages/games/Schulte.tsx` | mode 选择 + 闯关状态机 + 进度持久化 |
| 新建 | `src/components/game/QuestLevelIntro.tsx` | 关卡规则说明卡 + 开始按钮 |
| 新建 | `src/components/game/QuestHUD.tsx` | 顶部 HUD（关卡号 / 时限条 / 命数 / combo 显示） |
| 新建 | `src/components/game/QuestResultDialog.tsx` | 通关 / 失败 / 全通关弹窗 |
| 修改 | `src/components/game/index.ts` | 导出新组件 |
| 新建 | `tests/unit/schulteQuestConfig.test.ts` | 测试 combo / 星级 / 评分 / mixed 序列 |
| 新建 | `tests/unit/normalizeDetails.test.ts` | 测试旧数据兜底 |
| 新建 | `tests/unit/questProgress.test.ts` | 测试 Dexie 查询函数 |
| 新建 | `tests/unit/SchulteGrid.test.tsx` | 测试 grid props 化 + combo 逻辑 |
| 新建 | `tests/unit/QuestLevelIntro.test.tsx` | 测试规则说明卡渲染 |
| 新建 | `tests/unit/QuestHUD.test.tsx` | 测试 HUD 渲染 |
| 新建 | `tests/unit/QuestResultDialog.test.tsx` | 测试弹窗按钮和星级显示 |

**项目约定：**
- 测试文件放在 `brain-train/tests/unit/`（vitest.config.ts 第 11 行已配置）
- 中文注释和 UI 文案
- 组件中文 commit message（参考现有 `📝` `✨` `🐛` 前缀风格）

---

## Chunk 1: 类型与工具函数

### Task 1: 扩展类型定义

**Files:**
- Modify: `src/types/index.ts:35-41`

- [ ] **Step 1: 扩展 SchulteDetails**

打开 `src/types/index.ts`，找到第 35-41 行的 `SchulteDetails` 接口，替换为：

```typescript
export interface SchulteDetails {
  mode: 'quest' | 'free';            // 必填，作为 discriminated tag
  level?: number;                    // 闯关模式有
  gridSize: 3 | 4 | 5 | 6;
  order: 'asc' | 'desc' | 'alternate' | 'mixed';
  completionTime: number;
  errorCount: number;
  clickSequence: number[];
  maxCombo: number;
  livesUsed?: number;
  timeLimitPerNumber?: number;
  stars?: 1 | 2 | 3;
}
```

- [ ] **Step 2: 在文件末尾（line 131 `GameStatus` 之后）新增闯关相关类型**

```typescript
// 舒尔特闯关 - 关卡配置（写死的常量，不入库）
export interface SchulteQuestLevelConfig {
  level: number;
  gridSize: 3 | 4 | 5 | 6;
  direction: 'asc' | 'desc' | 'alternate' | 'mixed';
  timeLimitPerNumber?: number;
  lives: 1 | 2 | 3;
  comboTarget: number;
}

// 舒尔特闯关 - 玩家进度（入库，单条记录）
export interface SchulteQuestProgress {
  id: 'singleton';                  // 固定主键，使用 put 而非 add
  clearedLevel: number;             // 已通关的最高关（0-10）
  totalStars: number;               // 累计星数（0-30）
  inProgressLevel?: number;         // 暂停退出时未完成的关
  levelRecords: Record<number, {
    stars: 1 | 2 | 3;
    bestScore: number;
    bestCombo: number;
    bestTime: number;
  }>;
}
```

- [ ] **Step 3: 运行 TypeScript 编译检查**

```bash
cd brain-train && pnpm exec tsc -b --noEmit
```

Expected: 编译失败，因为 `Schulte.tsx:80-86` 构造的 `TrainingDetails` 缺少 `mode` 和 `maxCombo` 必填字段。这是预期的（下一个 Task 修），先确认其他类型无新错误。

- [ ] **Step 4: 提交**

```bash
git add src/types/index.ts
git commit -m "📝 扩展 SchulteDetails 类型，新增闯关相关类型"
```

---

### Task 2: 旧数据兼容工具 normalizeSchulteDetails

**Files:**
- Create: `src/lib/normalizeDetails.ts`
- Create: `tests/unit/normalizeDetails.test.ts`

- [ ] **Step 1: 写失败测试**

新建 `tests/unit/normalizeDetails.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeSchulteDetails } from '../../src/lib/normalizeDetails';
import type { SchulteDetails } from '../../src/types';

describe('normalizeSchulteDetails', () => {
  it('对带 mode 的数据原样返回', () => {
    const input: SchulteDetails = {
      mode: 'free',
      gridSize: 5,
      order: 'asc',
      completionTime: 30,
      errorCount: 0,
      clickSequence: [],
      maxCombo: 0,
    };
    expect(normalizeSchulteDetails(input)).toEqual(input);
  });

  it('对旧数据（无 mode）兜底为 free + maxCombo 0', () => {
    const legacy = {
      gridSize: 5,
      order: 'asc',
      completionTime: 30,
      errorCount: 2,
      clickSequence: [1, 2, 3],
    };
    const result = normalizeSchulteDetails(legacy);
    expect(result.mode).toBe('free');
    expect(result.maxCombo).toBe(0);
    expect(result.gridSize).toBe(5);
    expect(result.errorCount).toBe(2);
  });

  it('保留旧数据的所有原字段', () => {
    const legacy = {
      gridSize: 4,
      order: 'desc',
      completionTime: 45.5,
      errorCount: 1,
      clickSequence: [4, 3, 2, 1],
    };
    const result = normalizeSchulteDetails(legacy);
    expect(result.completionTime).toBe(45.5);
    expect(result.clickSequence).toEqual([4, 3, 2, 1]);
  });

  it('对已经是 quest 模式的数据保留所有字段', () => {
    const quest: SchulteDetails = {
      mode: 'quest',
      level: 5,
      gridSize: 5,
      order: 'desc',
      completionTime: 47,
      errorCount: 0,
      clickSequence: [],
      maxCombo: 18,
      livesUsed: 0,
      timeLimitPerNumber: 5,
      stars: 3,
    };
    expect(normalizeSchulteDetails(quest)).toEqual(quest);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd brain-train && pnpm test tests/unit/normalizeDetails.test.ts
```

Expected: FAIL — `Cannot find module '../../src/lib/normalizeDetails'`

- [ ] **Step 3: 实现 normalizeSchulteDetails**

新建 `src/lib/normalizeDetails.ts`：

```typescript
import type { SchulteDetails } from '../types';

// 兜底处理旧训练记录（没有 mode 字段）
// 详见 spec §6.1
export function normalizeSchulteDetails(raw: any): SchulteDetails {
  if (raw && raw.mode) return raw as SchulteDetails;
  return {
    ...raw,
    mode: 'free' as const,
    maxCombo: 0,
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd brain-train && pnpm test tests/unit/normalizeDetails.test.ts
```

Expected: PASS — 4 tests passed

- [ ] **Step 5: 提交**

```bash
git add src/lib/normalizeDetails.ts tests/unit/normalizeDetails.test.ts
git commit -m "✨ 新增 normalizeSchulteDetails 旧数据兼容工具"
```

---

### Task 3: 关卡配置 + Combo/星级/评分工具函数

**Files:**
- Create: `src/lib/schulteQuestConfig.ts`
- Create: `tests/unit/schulteQuestConfig.test.ts`

- [ ] **Step 1: 写失败测试（先写 combo 倍率 + 星级 + 评分）**

新建 `tests/unit/schulteQuestConfig.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import {
  SCHULTE_QUEST_LEVELS,
  COMBO_MULTIPLIER_TABLE,
  computeComboMultiplier,
  computeStars,
  computeScore,
  generateMixedSequence,
} from '../../src/lib/schulteQuestConfig';

describe('SCHULTE_QUEST_LEVELS', () => {
  it('有 10 关', () => {
    expect(SCHULTE_QUEST_LEVELS).toHaveLength(10);
  });

  it('第 1 关是 3×3 正向 3 命无时限', () => {
    const lv1 = SCHULTE_QUEST_LEVELS[0];
    expect(lv1.level).toBe(1);
    expect(lv1.gridSize).toBe(3);
    expect(lv1.direction).toBe('asc');
    expect(lv1.lives).toBe(3);
    expect(lv1.timeLimitPerNumber).toBeUndefined();
    expect(lv1.comboTarget).toBe(8);
  });

  it('第 10 关是 6×6 mixed 1 命 3s/数字', () => {
    const lv10 = SCHULTE_QUEST_LEVELS[9];
    expect(lv10.level).toBe(10);
    expect(lv10.gridSize).toBe(6);
    expect(lv10.direction).toBe('mixed');
    expect(lv10.lives).toBe(1);
    expect(lv10.timeLimitPerNumber).toBe(3);
    expect(lv10.comboTarget).toBe(30);
  });
});

describe('COMBO_MULTIPLIER_TABLE', () => {
  it('是按 combo 升序排列的分段表', () => {
    expect(COMBO_MULTIPLIER_TABLE[0]).toEqual({ minCombo: 0, multiplier: 1.0 });
    expect(COMBO_MULTIPLIER_TABLE[1]).toEqual({ minCombo: 5, multiplier: 1.5 });
    expect(COMBO_MULTIPLIER_TABLE[2]).toEqual({ minCombo: 10, multiplier: 2.0 });
    expect(COMBO_MULTIPLIER_TABLE[3]).toEqual({ minCombo: 20, multiplier: 3.0 });
    expect(COMBO_MULTIPLIER_TABLE[4]).toEqual({ minCombo: 50, multiplier: 5.0 });
  });
});

describe('computeComboMultiplier', () => {
  it.each([
    [0, 1.0],
    [4, 1.0],
    [5, 1.5],
    [9, 1.5],
    [10, 2.0],
    [19, 2.0],
    [20, 3.0],
    [49, 3.0],
    [50, 5.0],
    [100, 5.0],
  ])('combo %i → 倍率 %f', (combo, expected) => {
    expect(computeComboMultiplier(combo)).toBe(expected);
  });
});

describe('computeStars', () => {
  it('未通关返回 0 星', () => {
    expect(computeStars({ passed: false, maxCombo: 100, errorCount: 0, comboTarget: 10 })).toBe(0);
  });

  it('通关保底 1 星', () => {
    expect(computeStars({ passed: true, maxCombo: 0, errorCount: 5, comboTarget: 10 })).toBe(1);
  });

  it('通关 + combo 达标 + 零错误 → 3 星', () => {
    expect(computeStars({ passed: true, maxCombo: 18, errorCount: 0, comboTarget: 15 })).toBe(3);
  });

  it('通关 + combo 达标 + 有错误 → 2 星', () => {
    expect(computeStars({ passed: true, maxCombo: 18, errorCount: 3, comboTarget: 15 })).toBe(2);
  });

  it('通关 + combo 不达标 + 零错误 → 2 星', () => {
    expect(computeStars({ passed: true, maxCombo: 5, errorCount: 0, comboTarget: 15 })).toBe(2);
  });
});

describe('computeScore', () => {
  it('第 5 关：基础 500 + 时间奖励 50 + combo 18 ×2.0 = 1100', () => {
    const score = computeScore({
      level: 5,
      timeLimitPerNumber: 5,
      gridSize: 5,
      maxCombo: 18,
      remainingTime: 10,
    });
    expect(score).toBe(1100);
  });

  it('无时限关卡：时间奖励为 0', () => {
    const score = computeScore({
      level: 1,
      timeLimitPerNumber: undefined,
      gridSize: 3,
      maxCombo: 8,
      remainingTime: 0,
    });
    // 基础 100 × 倍率 1.5 = 150
    expect(score).toBe(150);
  });

  it('combo 为 0 时倍率兜底 ×1.0', () => {
    const score = computeScore({
      level: 1,
      timeLimitPerNumber: undefined,
      gridSize: 3,
      maxCombo: 0,
      remainingTime: 0,
    });
    expect(score).toBe(100);
  });
});

describe('generateMixedSequence', () => {
  it('生成 1..N 的不重复序列', () => {
    const seq = generateMixedSequence(5, 12345);
    expect(seq).toHaveLength(25);
    const sorted = [...seq].sort((a, b) => a - b);
    expect(sorted).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });

  it('相同 startTime 生成相同序列', () => {
    const a = generateMixedSequence(4, 999);
    const b = generateMixedSequence(4, 999);
    expect(a).toEqual(b);
  });

  it('不同 startTime 生成不同序列（高概率）', () => {
    const a = generateMixedSequence(5, 1);
    const b = generateMixedSequence(5, 2);
    expect(a).not.toEqual(b);
  });

  it('3×3 网格生成 9 个数字', () => {
    const seq = generateMixedSequence(3, 0);
    expect(seq).toHaveLength(9);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd brain-train && pnpm test tests/unit/schulteQuestConfig.test.ts
```

Expected: FAIL — `Cannot find module '../../src/lib/schulteQuestConfig'`

- [ ] **Step 3: 实现 schulteQuestConfig.ts**

新建 `src/lib/schulteQuestConfig.ts`：

```typescript
import type { SchulteQuestLevelConfig } from '../types';

// 10 关配置（spec §4.1）
export const SCHULTE_QUEST_LEVELS: readonly SchulteQuestLevelConfig[] = [
  { level: 1,  gridSize: 3, direction: 'asc',                            lives: 3, comboTarget: 8 },
  { level: 2,  gridSize: 4, direction: 'asc',                            lives: 3, comboTarget: 10 },
  { level: 3,  gridSize: 4, direction: 'desc',                           lives: 3, comboTarget: 12 },
  { level: 4,  gridSize: 5, direction: 'asc',                            lives: 3, comboTarget: 15 },
  { level: 5,  gridSize: 5, direction: 'desc',       timeLimitPerNumber: 5, lives: 3, comboTarget: 18 },
  { level: 6,  gridSize: 5, direction: 'alternate',  timeLimitPerNumber: 5, lives: 3, comboTarget: 20 },
  { level: 7,  gridSize: 5, direction: 'alternate',  timeLimitPerNumber: 4, lives: 2, comboTarget: 22 },
  { level: 8,  gridSize: 6, direction: 'asc',        timeLimitPerNumber: 4, lives: 2, comboTarget: 25 },
  { level: 9,  gridSize: 6, direction: 'desc',       timeLimitPerNumber: 3, lives: 1, comboTarget: 28 },
  { level: 10, gridSize: 6, direction: 'mixed',      timeLimitPerNumber: 3, lives: 1, comboTarget: 30 },
] as const;

// Combo 倍率表（spec §4.3）
export const COMBO_MULTIPLIER_TABLE = [
  { minCombo: 0,  multiplier: 1.0 },
  { minCombo: 5,  multiplier: 1.5 },
  { minCombo: 10, multiplier: 2.0 },
  { minCombo: 20, multiplier: 3.0 },
  { minCombo: 50, multiplier: 5.0 },
] as const;

// 根据 combo 数查倍率
export function computeComboMultiplier(combo: number): number {
  let multiplier = 1.0;
  for (const entry of COMBO_MULTIPLIER_TABLE) {
    if (combo >= entry.minCombo) multiplier = entry.multiplier;
  }
  return multiplier;
}

// 星级判定（spec §4.4）
export function computeStars(args: {
  passed: boolean;
  maxCombo: number;
  errorCount: number;
  comboTarget: number;
}): 0 | 1 | 2 | 3 {
  const { passed, maxCombo, errorCount, comboTarget } = args;
  if (!passed) return 0;
  let stars: 0 | 1 | 2 | 3 = 1;
  if (maxCombo >= comboTarget) stars++;
  if (errorCount === 0) stars++;
  return Math.min(3, stars) as 0 | 1 | 2 | 3;
}

// 得分计算（spec §4.5）
export function computeScore(args: {
  level: number;
  timeLimitPerNumber?: number;
  gridSize: number;
  maxCombo: number;
  remainingTime: number;
}): number {
  const { level, timeLimitPerNumber, gridSize, maxCombo, remainingTime } = args;
  const baseScore = 100 * level;
  const timeBonus = timeLimitPerNumber ? remainingTime * 5 : 0;
  const multiplier = computeComboMultiplier(maxCombo);
  return Math.round((baseScore + timeBonus) * multiplier);
}

// 确定性伪随机数（mulberry32 算法）
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// mixed 方向的固定序列生成（spec §4.2）
export function generateMixedSequence(gridSize: number, startTime: number): number[] {
  const N = gridSize * gridSize;
  const seed = startTime % 4294967296;
  const rng = mulberry32(seed);
  const arr = Array.from({ length: N }, (_, i) => i + 1);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 根据关卡 level 获取配置
export function getLevelConfig(level: number): SchulteQuestLevelConfig | undefined {
  return SCHULTE_QUEST_LEVELS.find((l) => l.level === level);
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd brain-train && pnpm test tests/unit/schulteQuestConfig.test.ts
```

Expected: PASS — 所有测试通过（约 25 个）

- [ ] **Step 5: 提交**

```bash
git add src/lib/schulteQuestConfig.ts tests/unit/schulteQuestConfig.test.ts
git commit -m "✨ 新增舒尔特闯关配置和工具函数（combo/星级/评分/序列生成）"
```

---

## Chunk 2: 数据库层

> **前置依赖（必须已完成 Chunk 1）：**
> - `src/types/index.ts` 已导出 `SchulteQuestProgress`（Task 1 步骤 2 末尾追加）
> - `src/lib/normalizeDetails.ts` 已创建并导出 `normalizeSchulteDetails`（Task 2）
>
> 本 chunk 所有 import 假设以上两个产物已就绪。若未完成，先回到 Chunk 1。

### Task 4: Dexie v3 schema 扩展 + 查询函数

**Files:**
- Modify: `src/db/index.ts`
- Modify: `src/db/queries.ts`
- Create: `tests/unit/questProgress.test.ts`

- [ ] **Step 1: 写失败测试**

新建 `tests/unit/questProgress.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db';
import {
  getQuestProgress,
  saveQuestProgress,
  createInitialProgress,
} from '../../src/db/queries';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('SchulteQuestProgress 持久化', () => {
  it('无记录时返回初始进度', async () => {
    const p = await getQuestProgress();
    expect(p.clearedLevel).toBe(0);
    expect(p.totalStars).toBe(0);
    expect(p.inProgressLevel).toBeUndefined();
    expect(p.levelRecords).toEqual({});
  });

  it('saveQuestProgress 写入后可读取', async () => {
    await saveQuestProgress({
      id: 'singleton',
      clearedLevel: 3,
      totalStars: 6,
      inProgressLevel: 4,
      levelRecords: {
        1: { stars: 2, bestScore: 100, bestCombo: 10, bestTime: 15 },
        2: { stars: 1, bestScore: 100, bestCombo: 5, bestTime: 20 },
        3: { stars: 3, bestScore: 400, bestCombo: 15, bestTime: 25 },
      },
    });
    const p = await getQuestProgress();
    expect(p.clearedLevel).toBe(3);
    expect(p.totalStars).toBe(6);
    expect(p.inProgressLevel).toBe(4);
    expect(Object.keys(p.levelRecords)).toHaveLength(3);
  });

  it('多次 put 是更新而不是新增', async () => {
    await saveQuestProgress(createInitialProgress());
    await saveQuestProgress({
      id: 'singleton',
      clearedLevel: 1,
      totalStars: 2,
      levelRecords: { 1: { stars: 2, bestScore: 100, bestCombo: 10, bestTime: 15 } },
    });
    const all = await db.schulteQuestProgress.toArray();
    expect(all).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 安装 fake-indexeddb 并加入全局 setup**

```bash
cd brain-train && pnpm add -D fake-indexeddb
```

打开 `tests/setup.ts`，追加一行（确保在任何 Dexie 表打开前注入到全局作用域）：

```typescript
import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'
```

> 这样后续测试文件就不必每个都 `import 'fake-indexeddb/auto'`，避免顺序耦合导致的间歇性 `indexeddb is not defined`。

- [ ] **Step 3: 运行测试确认失败**

```bash
cd brain-train && pnpm test tests/unit/questProgress.test.ts
```

Expected: FAIL — `db.schulteQuestProgress is undefined` 或 `getQuestProgress is not a function`

- [ ] **Step 4: 修改 src/db/index.ts 加入 v3 schema**

打开 `src/db/index.ts`，在 `import` 行后加入新类型导入：

```typescript
import type { UserProfile, TrainingRecord, DailyGoal, SchulteQuestProgress } from '../types';
```

在 class 内部加新表声明：

```typescript
export class BrainTrainDB extends Dexie {
  userProfile!: Table<UserProfile>;
  trainingRecords!: Table<TrainingRecord>;
  dailyGoals!: Table<DailyGoal>;
  schulteQuestProgress!: Table<SchulteQuestProgress>;

  constructor() {
    super('BrainTrainDB');
    this.version(1).stores({
      userProfile: 'id',
      trainingRecords: 'id, mode, startedAt, [mode+startedAt]',
      dailyGoals: 'date'
    });

    this.version(2).stores({
      userProfile: 'id',
      trainingRecords: 'id, mode, startedAt, [mode+startedAt]',
      dailyGoals: 'date'
    }).upgrade((tx) => {
      tx.table('trainingRecords').clear();
      tx.table('dailyGoals').clear();
    });

    // v3: 新增舒尔特闯关进度表
    this.version(3).stores({
      userProfile: 'id',
      trainingRecords: 'id, mode, startedAt, [mode+startedAt]',
      dailyGoals: 'date',
      schulteQuestProgress: 'id',
    });
  }
}
```

- [ ] **Step 5: 修改 src/db/queries.ts 加入查询函数**

打开 `src/db/queries.ts`，在文件顶部 import 加入：

```typescript
import type {
  UserProfile,
  TrainingRecord,
  DailyGoal,
  TrainingMode,
  Statistics,
  SchulteQuestProgress,
} from '../types';
```

在文件末尾追加：

```typescript
// SchulteQuestProgress
export function createInitialProgress(): SchulteQuestProgress {
  return {
    id: 'singleton',
    clearedLevel: 0,
    totalStars: 0,
    levelRecords: {},
  };
}

export async function getQuestProgress(): Promise<SchulteQuestProgress> {
  const record = await db.schulteQuestProgress.get('singleton');
  return record ?? createInitialProgress();
}

export async function saveQuestProgress(progress: SchulteQuestProgress): Promise<void> {
  await db.schulteQuestProgress.put(progress);
}
```

- [ ] **Step 6: 运行测试确认通过**

```bash
cd brain-train && pnpm test tests/unit/questProgress.test.ts
```

Expected: PASS — 3 tests passed

- [ ] **Step 7: 提交**

```bash
git add src/db/index.ts src/db/queries.ts tests/unit/questProgress.test.ts tests/setup.ts package.json pnpm-lock.yaml
git commit -m "✨ 新增 schulteQuestProgress 表和查询函数（Dexie v3）"
```

> 注：所有 `git add` 路径都相对于 `brain-train/`（因为 shell 已 `cd brain-train`）。

---

### Task 5: 在 queries.ts 中应用 normalizeSchulteDetails

**Files:**
- Modify: `src/db/queries.ts`

- [ ] **Step 1: 写测试验证旧数据兜底**

在 `tests/unit/questProgress.test.ts` 末尾追加：

```typescript
describe('读取旧 schulte 训练记录时自动兜底', () => {
  it('旧记录被 normalize 后有 mode 和 maxCombo', async () => {
    // 模拟旧数据：直接写入无 mode 字段的记录
    const legacyRecord: any = {
      id: 'legacy-1',
      mode: 'schulte',
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      duration: 30,
      score: 85,
      accuracy: 100,
      details: {
        gridSize: 5,
        order: 'asc',
        completionTime: 30,
        errorCount: 0,
        clickSequence: [],
        // 故意省略 mode 和 maxCombo
      },
    };
    await db.trainingRecords.put(legacyRecord);

    const records = await getTrainingRecords();
    const schulteRecords = records.filter(r => r.mode === 'schulte');
    expect(schulteRecords).toHaveLength(1);
    const details = schulteRecords[0].details as any;
    expect(details.mode).toBe('free');
    expect(details.maxCombo).toBe(0);
  });
});
```

并在文件顶部导入 `getTrainingRecords`：

```typescript
import {
  getQuestProgress,
  saveQuestProgress,
  createInitialProgress,
  getTrainingRecords,
} from '../../src/db/queries';
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd brain-train && pnpm test tests/unit/questProgress.test.ts
```

Expected: FAIL — `details.mode` 是 undefined（旧数据没经过 normalize）

- [ ] **Step 3: 修改 src/db/queries.ts，按函数形态分别包装 normalize**

打开 `src/db/queries.ts`。文件顶部加入 import：

```typescript
import { normalizeSchulteDetails } from '../lib/normalizeDetails';
```

不同读取函数返回类型不同，必须分别处理（**不要套用同一种 map**）。

**3a. `getTrainingRecords`（返回 `TrainingRecord[]`）** — 在 return 前包 map：

```typescript
export async function getTrainingRecords(options?: {
  mode?: TrainingMode;
  limit?: number;
  startDate?: string;
  endDate?: string;
}): Promise<TrainingRecord[]> {
  let query = db.trainingRecords.toCollection();

  if (options?.mode) {
    query = db.trainingRecords.where('mode').equals(options.mode);
  }

  if (options?.startDate && options?.endDate) {
    query = db.trainingRecords
      .where('startedAt')
      .between(options.startDate, options.endDate);
  }

  const records = await query.reverse().limit(options?.limit || 100).toArray();

  return records.map((r) =>
    r.mode === 'schulte'
      ? { ...r, details: normalizeSchulteDetails(r.details) }
      : r
  );
}
```

**3b. `getTodayTrainingRecords`（返回 `TrainingRecord[]`）** — 同样在 return 前包 map：

```typescript
export async function getTodayTrainingRecords(): Promise<TrainingRecord[]> {
  const today = new Date().toISOString().split('T')[0];
  const records = await db.trainingRecords
    .where('startedAt')
    .startsWith(today)
    .toArray();

  return records.map((r) =>
    r.mode === 'schulte'
      ? { ...r, details: normalizeSchulteDetails(r.details) }
      : r
  );
}
```

**3c. `getTrainingRecordById`（返回 `TrainingRecord | undefined`）** — 单对象，不能用 `.map`：

```typescript
export async function getTrainingRecordById(id: string): Promise<TrainingRecord | undefined> {
  const r = await db.trainingRecords.get(id);
  if (!r) return undefined;
  return r.mode === 'schulte'
    ? { ...r, details: normalizeSchulteDetails(r.details) }
    : r;
}
```

**3d. `computeStatistics`（内部直接 `db.trainingRecords.toArray()`，无 100 条限制）** — 必须就地包装，**不要**改让该函数走 `getTrainingRecords()`（那会把统计范围悄悄截断到 100 条）。修改方式：

```typescript
export async function computeStatistics(): Promise<Statistics> {
  const rawRecords = await db.trainingRecords.toArray();
  const records = rawRecords.map((r) =>
    r.mode === 'schulte'
      ? { ...r, details: normalizeSchulteDetails(r.details) }
      : r
  );

  // 原有逻辑用 records，不要用 rawRecords
  const overall = {
    totalSessions: records.length,
    // ...
  };
  // ...
}
```

> 注：以上 4 个函数是当前 queries.ts 中**全部**的 schulte 记录读取路径。其他写入函数（如 `saveTrainingRecord`）不动。

- [ ] **Step 4: 运行测试确认通过**

```bash
cd brain-train && pnpm test tests/unit/questProgress.test.ts
```

Expected: PASS — 4 tests passed

- [ ] **Step 5: 运行全量测试确认未破坏其他功能**

```bash
cd brain-train && pnpm test
```

Expected: 所有现有测试仍通过

- [ ] **Step 6: 提交**

```bash
git add src/db/queries.ts tests/unit/questProgress.test.ts
git commit -m "🐛 读取 schulte 训练记录时自动 normalize（旧数据兼容）"
```

---

## Chunk 3: SchulteGrid 重构

### Task 6: SchulteGrid 接受 props + 内部 combo 状态

**Files:**
- Modify: `src/components/game/SchulteGrid.tsx`
- Create: `tests/unit/SchulteGrid.test.tsx`

- [ ] **Step 1: 写失败测试**

新建 `tests/unit/SchulteGrid.test.tsx`：

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SchulteGrid } from '../../src/components/game/SchulteGrid';

describe('SchulteGrid', () => {
  it('渲染 3×3 网格（9 个数字）', () => {
    render(
      <SchulteGrid
        gridSize={3}
        order="asc"
        isActive={true}
        startTime={1000}
        onCorrectClick={() => {}}
        onWrongClick={() => {}}
        onComplete={() => {}}
      />
    );
    const buttons = screen.getAllByRole('button');
    // 9 个数字按钮，可能还有其他控件
    expect(buttons.length).toBeGreaterThanOrEqual(9);
  });

  it('渲染 5×5 网格（25 个数字）', () => {
    render(
      <SchulteGrid
        gridSize={5}
        order="asc"
        isActive={true}
        startTime={1000}
        onCorrectClick={() => {}}
        onWrongClick={() => {}}
        onComplete={() => {}}
      />
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(25);
  });

  it('正向模式：点击 1 是正确的', () => {
    const onCorrect = vi.fn();
    const onWrong = vi.fn();
    render(
      <SchulteGrid
        gridSize={3}
        order="asc"
        isActive={true}
        startTime={1000}
        onCorrectClick={onCorrect}
        onWrongClick={onWrong}
        onComplete={() => {}}
      />
    );
    const buttonOne = screen.getByText('1');
    fireEvent.click(buttonOne);
    expect(onCorrect).toHaveBeenCalledTimes(1);
    expect(onWrong).not.toHaveBeenCalled();
  });

  it('反向模式：点击 N（最大值）是正确的', () => {
    const onCorrect = vi.fn();
    render(
      <SchulteGrid
        gridSize={3}
        order="desc"
        isActive={true}
        startTime={1000}
        onCorrectClick={onCorrect}
        onWrongClick={() => {}}
        onComplete={() => {}}
      />
    );
    // 3×3 = 9，反向第一个目标是 9
    const buttonNine = screen.getByText('9');
    fireEvent.click(buttonNine);
    expect(onCorrect).toHaveBeenCalledTimes(1);
  });

  it('错误点击触发 onWrongClick', () => {
    const onWrong = vi.fn();
    render(
      <SchulteGrid
        gridSize={3}
        order="asc"
        isActive={true}
        startTime={1000}
        onCorrectClick={() => {}}
        onWrongClick={onWrong}
        onComplete={() => {}}
      />
    );
    // 3×3 = 9 个数字，正向第一个目标是 1，点 2 是错的
    const buttonTwo = screen.getByText('2');
    fireEvent.click(buttonTwo);
    expect(onWrong).toHaveBeenCalledTimes(1);
  });

  it('连续正确点击触发 onComboChange', () => {
    const onCombo = vi.fn();
    render(
      <SchulteGrid
        gridSize={3}
        order="asc"
        isActive={true}
        startTime={1000}
        onCorrectClick={() => {}}
        onWrongClick={() => {}}
        onComplete={() => {}}
        onComboChange={onCombo}
      />
    );
    fireEvent.click(screen.getByText('1'));
    expect(onCombo).toHaveBeenLastCalledWith(1);
    fireEvent.click(screen.getByText('2'));
    expect(onCombo).toHaveBeenLastCalledWith(2);
  });

  it('错误点击清零 combo', () => {
    const onCombo = vi.fn();
    render(
      <SchulteGrid
        gridSize={3}
        order="asc"
        isActive={true}
        startTime={1000}
        onCorrectClick={() => {}}
        onWrongClick={() => {}}
        onComplete={() => {}}
        onComboChange={onCombo}
      />
    );
    fireEvent.click(screen.getByText('1')); // combo 1
    fireEvent.click(screen.getByText('2')); // combo 2
    fireEvent.click(screen.getByText('4')); // 错：下一个应该是 3
    expect(onCombo).toHaveBeenLastCalledWith(0);
  });

  it('完成所有数字触发 onComplete', () => {
    const onComplete = vi.fn();
    render(
      <SchulteGrid
        gridSize={2}
        order="asc"
        isActive={true}
        startTime={1000}
        onCorrectClick={() => {}}
        onWrongClick={() => {}}
        onComplete={onComplete}
      />
    );
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('2'));
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByText('4'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd brain-train && pnpm test tests/unit/SchulteGrid.test.tsx
```

Expected: FAIL — 当前 SchulteGrid 不接受 `gridSize` prop，硬编码 GRID_SIZE=5

- [ ] **Step 3: 重构 SchulteGrid.tsx**

替换整个文件 `src/components/game/SchulteGrid.tsx`：

```typescript
import { useState, useCallback, useEffect, useMemo } from 'react';

interface SchulteGridProps {
  gridSize: 3 | 4 | 5 | 6;
  order: 'asc' | 'desc' | 'alternate' | 'mixed';
  expectedSequence?: number[];          // mixed 模式预设序列
  isActive: boolean;
  startTime: number;
  onCorrectClick: (number: number, time: number) => void;
  onWrongClick: () => void;
  onComplete?: () => void;
  onComboChange?: (combo: number) => void;
}

// 计算下一个目标数字的索引序列
function buildTargetSequence(
  gridSize: number,
  order: 'asc' | 'desc' | 'alternate' | 'mixed',
  expectedSequence?: number[]
): number[] {
  const N = gridSize * gridSize;
  if (order === 'asc') {
    return Array.from({ length: N }, (_, i) => i + 1);
  }
  if (order === 'desc') {
    return Array.from({ length: N }, (_, i) => N - i);
  }
  if (order === 'alternate') {
    // 1, N, 2, N-1, 3, N-2, ...
    const seq: number[] = [];
    let lo = 1, hi = N;
    for (let i = 0; i < N; i++) {
      if (i % 2 === 0) {
        seq.push(lo++);
      } else {
        seq.push(hi--);
      }
    }
    return seq;
  }
  // mixed
  if (expectedSequence && expectedSequence.length === N) {
    return [...expectedSequence];
  }
  // 兜底（不该到这里）
  return Array.from({ length: N }, (_, i) => i + 1);
}

export function SchulteGrid({
  gridSize,
  order,
  expectedSequence,
  isActive,
  startTime,
  onCorrectClick,
  onWrongClick,
  onComplete,
  onComboChange,
}: SchulteGridProps) {
  const [clickedCount, setClickedCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(startTime);

  const N = gridSize * gridSize;

  // 生成乱序网格（仅位置乱序，数字本身按 targetSequence 顺序点）
  const gridNumbers = useMemo(() => {
    const arr = Array.from({ length: N }, (_, i) => i + 1);
    // Fisher-Yates shuffle with startTime seed
    const seed = startTime % 4294967296;
    let s = seed;
    const rng = () => {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [N, startTime]);

  // 计算下一个目标数字
  const targetSequence = useMemo(
    () => buildTargetSequence(gridSize, order, expectedSequence),
    [gridSize, order, expectedSequence]
  );

  const expectedNumber = targetSequence[clickedCount];

  // 重置
  useEffect(() => {
    setClickedCount(0);
    setCombo(0);
    setLastClickTime(startTime);
    onComboChange?.(0);
  }, [startTime]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNumberClick = useCallback((number: number) => {
    if (!isActive) return;

    if (number === expectedNumber) {
      const currentTime = Date.now();
      const clickDuration = (currentTime - lastClickTime) / 1000;
      const newClicked = clickedCount + 1;
      const newCombo = combo + 1;
      setClickedCount(newClicked);
      setCombo(newCombo);
      setLastClickTime(currentTime);
      onCorrectClick(number, clickDuration);
      onComboChange?.(newCombo);

      if (newClicked === N) {
        onComplete?.();
      }
    } else {
      setCombo(0);
      onComboChange?.(0);
      onWrongClick();
    }
  }, [isActive, clickedCount, combo, expectedNumber, lastClickTime, N, onCorrectClick, onWrongClick, onComplete, onComboChange]);

  // 已经点过的数字集合（用于显示已点击状态）
  const clickedNumbers = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < clickedCount; i++) {
      set.add(targetSequence[i]);
    }
    return set;
  }, [clickedCount, targetSequence]);

  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="relative w-full max-w-md aspect-square bg-surface-container-low rounded-xl p-4 shadow-2xl">
        <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full pointer-events-none" />
        <div
          className="grid gap-3 h-full w-full relative z-10"
          style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
        >
          {gridNumbers.map((number) => {
            const isClicked = clickedNumbers.has(number);
            return (
              <button
                key={number}
                onClick={() => handleNumberClick(number)}
                disabled={!isActive || isClicked}
                className={`
                  flex items-center justify-center rounded-xl text-xl font-bold
                  transition-all duration-200 cursor-pointer active:scale-95
                  ${isClicked
                    ? 'bg-muted text-muted-foreground cursor-default'
                    : 'bg-surface-container text-foreground hover:bg-surface-container-high shadow-sm'
                  }
                `}
                style={{ fontSize: gridSize >= 6 ? '0.9rem' : undefined }}
              >
                {number}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 修复 Schulte.tsx 因签名变化的破坏**

打开 `src/pages/games/Schulte.tsx`，第 124-131 行的 `<SchulteGrid>` 调用需要加 `gridSize` prop（自由模式固定 5×5）。同时把第 80-86 行的 details 加 `mode: 'free'` 和 `maxCombo: 0`。

```typescript
// Schulte.tsx 第 80-92 行的 handleComplete 内：
const details: TrainingDetails = {
  mode: 'free',
  gridSize: GRID_SIZE,
  order: GRID_ORDER,
  completionTime: totalTime,
  errorCount: errors,
  clickSequence,
  maxCombo: 0,
};

// Schulte.tsx 第 124-131 行的 <SchulteGrid>：
<SchulteGrid
  gridSize={GRID_SIZE}
  order={GRID_ORDER}
  onCorrectClick={handleCorrectClick}
  onWrongClick={handleWrongClick}
  onComplete={handleComplete}
  isActive={isPlaying}
  startTime={gameStartTime}
/>
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd brain-train && pnpm test tests/unit/SchulteGrid.test.tsx
```

Expected: PASS — 7 tests passed

- [ ] **Step 6: 运行全量测试**

```bash
cd brain-train && pnpm test
```

Expected: 全部通过

- [ ] **Step 7: 运行 TypeScript 检查**

```bash
cd brain-train && pnpm exec tsc -b --noEmit
```

Expected: 无错误

- [ ] **Step 8: 提交**

```bash
git add src/components/game/SchulteGrid.tsx src/pages/games/Schulte.tsx tests/unit/SchulteGrid.test.tsx
git commit -m "♻️ 重构 SchulteGrid 接受 gridSize/order props，加入内部 combo 状态"
```

---

## Chunk 4: 新 UI 组件

### Task 7: QuestLevelIntro 组件（关卡规则说明卡）

**Files:**
- Create: `src/components/game/QuestLevelIntro.tsx`
- Create: `tests/unit/QuestLevelIntro.test.tsx`
- Modify: `src/components/game/index.ts`

- [ ] **Step 1: 写失败测试**

新建 `tests/unit/QuestLevelIntro.test.tsx`：

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestLevelIntro } from '../../src/components/game/QuestLevelIntro';
import { SCHULTE_QUEST_LEVELS } from '../../src/lib/schulteQuestConfig';

describe('QuestLevelIntro', () => {
  it('显示关卡号', () => {
    render(<QuestLevelIntro level={5} onStart={() => {}} />);
    expect(screen.getByText(/第\s*5\s*关/)).toBeInTheDocument();
  });

  it('显示网格规模', () => {
    render(<QuestLevelIntro level={5} onStart={() => {}} />);
    expect(screen.getByText(/5×5/)).toBeInTheDocument();
  });

  it('显示方向（反向时显示 25→1）', () => {
    render(<QuestLevelIntro level={5} onStart={() => {}} />);
    expect(screen.getByText(/反向/)).toBeInTheDocument();
  });

  it('显示时限（有时限时）', () => {
    render(<QuestLevelIntro level={5} onStart={() => {}} />);
    expect(screen.getByText(/每数字\s*5\s*秒/)).toBeInTheDocument();
  });

  it('不显示时限（无时限关卡）', () => {
    render(<QuestLevelIntro level={1} onStart={() => {}} />);
    expect(screen.queryByText(/每数字/)).not.toBeInTheDocument();
  });

  it('显示命数', () => {
    render(<QuestLevelIntro level={5} onStart={() => {}} />);
    expect(screen.getByText(/3\s*命/)).toBeInTheDocument();
  });

  it('显示 combo 目标', () => {
    render(<QuestLevelIntro level={5} onStart={() => {}} />);
    expect(screen.getByText(/combo.*18|18.*combo/i)).toBeInTheDocument();
  });

  it('点击开始按钮触发 onStart', () => {
    const onStart = vi.fn();
    render(<QuestLevelIntro level={1} onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: /开始/ }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('显示星级目标三项', () => {
    render(<QuestLevelIntro level={1} onStart={() => {}} />);
    expect(screen.getByText(/通关/)).toBeInTheDocument();
    expect(screen.getByText(/零错误|完美/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd brain-train && pnpm test tests/unit/QuestLevelIntro.test.tsx
```

Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现 QuestLevelIntro.tsx**

新建 `src/components/game/QuestLevelIntro.tsx`：

```typescript
import { motion } from 'framer-motion';
import { getLevelConfig } from '../../lib/schulteQuestConfig';

interface QuestLevelIntroProps {
  level: number;
  onStart: () => void;
}

const DIRECTION_LABELS: Record<string, string> = {
  asc: '正向（1→N）',
  desc: '反向（N→1）',
  alternate: '正反交替',
  mixed: '混合（开局展示）',
};

export function QuestLevelIntro({ level, onStart }: QuestLevelIntroProps) {
  const config = getLevelConfig(level);

  if (!config) {
    return null;
  }

  const N = config.gridSize * config.gridSize;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto p-6 bg-surface-container-low rounded-2xl shadow-lg"
    >
      <h2 className="text-center font-headline text-2xl font-extrabold mb-4">
        第 {level} 关
      </h2>

      <div className="space-y-2 mb-6 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">网格</span>
          <span className="font-bold">{config.gridSize}×{config.gridSize}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">方向</span>
          <span className="font-bold">
            {DIRECTION_LABELS[config.direction]}
            {config.direction === 'desc' && `（${N}→1）`}
          </span>
        </div>
        {config.timeLimitPerNumber && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">时限</span>
            <span className="font-bold">每数字 {config.timeLimitPerNumber} 秒</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">命数</span>
          <span className="font-bold">{config.lives} 命</span>
        </div>
      </div>

      <div className="bg-accent/30 rounded-xl p-4 mb-6 space-y-1.5">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">星级目标</p>
        <p className="text-sm">⭐ 通关</p>
        <p className="text-sm">⭐⭐ combo ≥ {config.comboTarget}</p>
        <p className="text-sm">⭐⭐⭐ 零错误</p>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onStart}
        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-lg shadow-lg hover:bg-primary/90 transition-all"
      >
        开始
      </motion.button>
    </motion.div>
  );
}
```

- [ ] **Step 4: 在 src/components/game/index.ts 中导出**

打开 `src/components/game/index.ts`，在文件末尾追加：

```typescript
export { QuestLevelIntro } from './QuestLevelIntro';
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd brain-train && pnpm test tests/unit/QuestLevelIntro.test.tsx
```

Expected: PASS — 9 tests passed

- [ ] **Step 6: 提交**

```bash
git add src/components/game/QuestLevelIntro.tsx src/components/game/index.ts tests/unit/QuestLevelIntro.test.tsx
git commit -m "✨ 新增 QuestLevelIntro 关卡规则说明卡组件"
```

---

### Task 8: QuestHUD 组件（顶部 HUD）

**Files:**
- Create: `src/components/game/QuestHUD.tsx`
- Create: `tests/unit/QuestHUD.test.tsx`
- Modify: `src/components/game/index.ts`

- [ ] **Step 1: 写失败测试**

新建 `tests/unit/QuestHUD.test.tsx`：

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuestHUD } from '../../src/components/game/QuestHUD';

describe('QuestHUD', () => {
  it('显示关卡号和方向', () => {
    render(
      <QuestHUD
        level={5}
        direction="desc"
        lives={3}
        combo={12}
        remainingTime={undefined}
      />
    );
    expect(screen.getByText(/L5/)).toBeInTheDocument();
    expect(screen.getByText(/反向/)).toBeInTheDocument();
  });

  it('显示命数（3 命用 3 个 ❤）', () => {
    render(
      <QuestHUD level={5} direction="desc" lives={3} combo={0} remainingTime={undefined} />
    );
    const hearts = screen.getAllByText('❤');
    expect(hearts).toHaveLength(3);
  });

  it('命数减少时显示更少 ❤', () => {
    render(
      <QuestHUD level={5} direction="desc" lives={1} combo={0} remainingTime={undefined} />
    );
    const hearts = screen.getAllByText('❤');
    expect(hearts).toHaveLength(1);
  });

  it('combo > 0 时显示 COMBO 数字', () => {
    render(
      <QuestHUD level={5} direction="desc" lives={3} combo={8} remainingTime={undefined} />
    );
    expect(screen.getByText(/×8/)).toBeInTheDocument();
  });

  it('combo = 0 时不显示 COMBO 数字', () => {
    render(
      <QuestHUD level={5} direction="desc" lives={3} combo={0} remainingTime={undefined} />
    );
    expect(screen.queryByText(/COMBO/)).not.toBeInTheDocument();
  });

  it('有时限时显示剩余时间', () => {
    render(
      <QuestHUD level={5} direction="desc" lives={3} combo={0} remainingTime={23} />
    );
    expect(screen.getByText(/23/)).toBeInTheDocument();
  });

  it('无时限时不显示时间', () => {
    render(
      <QuestHUD level={1} direction="asc" lives={3} combo={0} remainingTime={undefined} />
    );
    expect(screen.queryByText(/⏱/)).not.toBeInTheDocument();
  });

  it('剩余时间 < 25% 时进度条变红', () => {
    // 第 5 关：5s/数字 × 25 数字 = 125s 总，25% = 31.25s
    // 假设 remainingTime = 10s（< 31.25）
    const { container } = render(
      <QuestHUD
        level={5}
        direction="desc"
        lives={3}
        combo={0}
        remainingTime={10}
        totalTime={125}
      />
    );
    const bar = container.querySelector('[data-testid="time-bar"]');
    expect(bar?.className).toMatch(/red|bg-red/);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd brain-train && pnpm test tests/unit/QuestHUD.test.tsx
```

Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现 QuestHUD.tsx**

新建 `src/components/game/QuestHUD.tsx`：

```typescript
import { motion, AnimatePresence } from 'framer-motion';

interface QuestHUDProps {
  level: number;
  direction: 'asc' | 'desc' | 'alternate' | 'mixed';
  lives: number;
  combo: number;
  remainingTime?: number;       // 秒，undefined = 无时限
  totalTime?: number;           // 总时间，用于计算百分比
}

const DIRECTION_SHORT: Record<string, string> = {
  asc: '正向',
  desc: '反向',
  alternate: '交替',
  mixed: '混合',
};

export function QuestHUD({ level, direction, lives, combo, remainingTime, totalTime }: QuestHUDProps) {
  const percent = totalTime && remainingTime !== undefined
    ? (remainingTime / totalTime) * 100
    : 100;
  const barColor = percent > 50 ? 'bg-green-500' : percent > 25 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="w-full max-w-md mx-auto px-4 py-3">
      {/* 顶部信息条 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold font-headline">L{level}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{DIRECTION_SHORT[direction]}</span>
        </div>

        {remainingTime !== undefined && (
          <div className="flex items-center gap-2 text-sm font-mono">
            <span>⏱</span>
            <span className="font-bold">{Math.ceil(remainingTime)}s</span>
          </div>
        )}

        <div className="flex items-center gap-1">
          {Array.from({ length: lives }).map((_, i) => (
            <span key={i} className="text-red-500">❤</span>
          ))}
        </div>
      </div>

      {/* 时间条 */}
      {remainingTime !== undefined && (
        <div className="h-1.5 bg-accent rounded-full overflow-hidden mb-3">
          <div
            data-testid="time-bar"
            className={`h-full ${barColor} transition-all duration-300`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {/* Combo 显示 */}
      <AnimatePresence>
        {combo >= 5 && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            key={combo}
            className="text-center mb-2"
          >
            <span className="text-xs font-bold text-primary uppercase tracking-[0.2em]">COMBO</span>
            <div className="text-3xl font-black font-headline text-primary">
              ×{combo}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 4: 导出**

在 `src/components/game/index.ts` 追加：

```typescript
export { QuestHUD } from './QuestHUD';
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd brain-train && pnpm test tests/unit/QuestHUD.test.tsx
```

Expected: PASS — 8 tests passed

- [ ] **Step 6: 提交**

```bash
git add src/components/game/QuestHUD.tsx src/components/game/index.ts tests/unit/QuestHUD.test.tsx
git commit -m "✨ 新增 QuestHUD 顶部 HUD 组件"
```

---

### Task 9: QuestResultDialog 组件（弹窗）

**Files:**
- Create: `src/components/game/QuestResultDialog.tsx`
- Create: `tests/unit/QuestResultDialog.test.tsx`
- Modify: `src/components/game/index.ts`

- [ ] **Step 1: 写失败测试**

新建 `tests/unit/QuestResultDialog.test.tsx`：

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestResultDialog } from '../../src/components/game/QuestResultDialog';

describe('QuestResultDialog - 通关弹窗', () => {
  const passingProps = {
    type: 'pass' as const,
    level: 5,
    stars: 2,
    score: 1100,
    maxCombo: 18,
    completionTime: 47,
    isLastLevel: false,
    onNext: () => {},
    onRetry: () => {},
  };

  it('显示通关标题', () => {
    render(<QuestResultDialog {...passingProps} />);
    expect(screen.getByText(/通关/)).toBeInTheDocument();
  });

  it('显示 2 颗亮星 + 1 颗暗星', () => {
    render(<QuestResultDialog {...passingProps} />);
    const stars = screen.getAllByText(/⭐|🌟/);
    expect(stars.length).toBeGreaterThanOrEqual(3);
  });

  it('显示得分', () => {
    render(<QuestResultDialog {...passingProps} />);
    expect(screen.getByText(/1100/)).toBeInTheDocument();
  });

  it('显示最高 combo', () => {
    render(<QuestResultDialog {...passingProps} />);
    expect(screen.getByText(/×18|18/)).toBeInTheDocument();
  });

  it('非最后一关时显示"下一关"按钮', () => {
    const onNext = vi.fn();
    render(<QuestResultDialog {...passingProps} onNext={onNext} />);
    fireEvent.click(screen.getByRole('button', { name: /下一关/ }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('最后一关时不显示"下一关"按钮', () => {
    render(<QuestResultDialog {...passingProps} isLastLevel={true} />);
    expect(screen.queryByRole('button', { name: /下一关/ })).not.toBeInTheDocument();
  });

  it('点击"重玩"触发 onRetry', () => {
    const onRetry = vi.fn();
    render(<QuestResultDialog {...passingProps} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /重玩/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('QuestResultDialog - 失败弹窗', () => {
  const failProps = {
    type: 'fail' as const,
    level: 5,
    stars: 0,
    score: 0,
    maxCombo: 6,
    completionTime: 23,
    progressText: '18/25',
    onRetry: () => {},
    onExit: () => {},
  };

  it('显示失败标题', () => {
    render(<QuestResultDialog {...failProps} />);
    expect(screen.getByText(/失败/)).toBeInTheDocument();
  });

  it('显示关卡进度', () => {
    render(<QuestResultDialog {...failProps} />);
    expect(screen.getByText(/18\/25/)).toBeInTheDocument();
  });

  it('点击"重试本关"触发 onRetry', () => {
    const onRetry = vi.fn();
    render(<QuestResultDialog {...failProps} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /重试本关/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('点击"退出"触发 onExit', () => {
    const onExit = vi.fn();
    render(<QuestResultDialog {...failProps} onExit={onExit} />);
    fireEvent.click(screen.getByRole('button', { name: /退出/ }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe('QuestResultDialog - 全通关弹窗', () => {
  it('显示全通关标题', () => {
    render(
      <QuestResultDialog
        type="completed"
        totalStars={28}
        totalTime={754}
        onRestart={() => {}}
      />
    );
    expect(screen.getByText(/全部通关|全通关/)).toBeInTheDocument();
  });

  it('显示总星数', () => {
    render(
      <QuestResultDialog
        type="completed"
        totalStars={28}
        totalTime={754}
        onRestart={() => {}}
      />
    );
    expect(screen.getByText(/28/)).toBeInTheDocument();
  });

  it('点击"重新挑战"触发 onRestart', () => {
    const onRestart = vi.fn();
    render(
      <QuestResultDialog
        type="completed"
        totalStars={28}
        totalTime={754}
        onRestart={onRestart}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /重新挑战/ }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd brain-train && pnpm test tests/unit/QuestResultDialog.test.tsx
```

Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现 QuestResultDialog.tsx**

新建 `src/components/game/QuestResultDialog.tsx`：

```typescript
import { motion } from 'framer-motion';

type DialogProps =
  | {
      type: 'pass';
      level: number;
      stars: 0 | 1 | 2 | 3;
      score: number;
      maxCombo: number;
      completionTime: number;
      isLastLevel: boolean;
      onNext: () => void;
      onRetry: () => void;
    }
  | {
      type: 'fail';
      level: number;
      maxCombo: number;
      progressText: string;
      onRetry: () => void;
      onExit: () => void;
    }
  | {
      type: 'completed';
      totalStars: number;
      totalTime: number;        // 秒
      onRestart: () => void;
    };

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m} 分 ${s} 秒`;
}

export function QuestResultDialog(props: DialogProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-surface rounded-2xl p-6 max-w-sm w-full shadow-2xl"
      >
        {props.type === 'pass' && <PassContent {...props} />}
        {props.type === 'fail' && <FailContent {...props} />}
        {props.type === 'completed' && <CompletedContent {...props} />}
      </motion.div>
    </motion.div>
  );
}

function PassContent({
  stars, score, maxCombo, completionTime, isLastLevel, onNext, onRetry,
}: Extract<DialogProps, { type: 'pass' }>) {
  return (
    <>
      <h3 className="text-center text-2xl font-extrabold font-headline mb-4">🎉 通关！</h3>
      <div className="flex justify-center gap-2 mb-4">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`text-3xl ${i <= stars ? '' : 'opacity-20 grayscale'}`}
          >
            ⭐
          </span>
        ))}
      </div>
      <div className="space-y-1 text-sm mb-6">
        <div className="flex justify-between">
          <span className="text-muted-foreground">得分</span>
          <span className="font-bold">{score}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">最高 combo</span>
          <span className="font-bold">×{maxCombo}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">用时</span>
          <span className="font-bold">{completionTime.toFixed(1)}s</span>
        </div>
      </div>
      <div className="flex gap-3">
        {!isLastLevel && (
          <button
            onClick={onNext}
            className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90"
          >
            下一关
          </button>
        )}
        <button
          onClick={onRetry}
          className="flex-1 py-3 bg-accent text-foreground rounded-xl font-bold hover:bg-accent/80"
        >
          重玩
        </button>
      </div>
    </>
  );
}

function FailContent({
  progressText, maxCombo, onRetry, onExit,
}: Extract<DialogProps, { type: 'fail' }>) {
  return (
    <>
      <h3 className="text-center text-2xl font-extrabold font-headline mb-4">💥 失败</h3>
      <div className="space-y-1 text-sm mb-6">
        <div className="flex justify-between">
          <span className="text-muted-foreground">关卡进度</span>
          <span className="font-bold">{progressText}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">最高 combo</span>
          <span className="font-bold">×{maxCombo}</span>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90"
        >
          重试本关
        </button>
        <button
          onClick={onExit}
          className="flex-1 py-3 bg-accent text-foreground rounded-xl font-bold hover:bg-accent/80"
        >
          退出
        </button>
      </div>
    </>
  );
}

function CompletedContent({
  totalStars, totalTime, onRestart,
}: Extract<DialogProps, { type: 'completed' }>) {
  return (
    <>
      <h3 className="text-center text-2xl font-extrabold font-headline mb-4">🏆 全部通关！</h3>
      <div className="space-y-1 text-sm mb-6">
        <div className="flex justify-between">
          <span className="text-muted-foreground">总星数</span>
          <span className="font-bold">⭐ {totalStars}/30</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">总用时</span>
          <span className="font-bold">{formatTime(totalTime)}</span>
        </div>
      </div>
      <button
        onClick={onRestart}
        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90"
      >
        重新挑战
      </button>
    </>
  );
}
```

- [ ] **Step 4: 导出**

在 `src/components/game/index.ts` 追加：

```typescript
export { QuestResultDialog } from './QuestResultDialog';
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd brain-train && pnpm test tests/unit/QuestResultDialog.test.tsx
```

Expected: PASS — 14 tests passed（通关弹窗 7 + 失败弹窗 4 + 全通关弹窗 3）

- [ ] **Step 6: 提交**

```bash
git add src/components/game/QuestResultDialog.tsx src/components/game/index.ts tests/unit/QuestResultDialog.test.tsx
git commit -m "✨ 新增 QuestResultDialog 弹窗组件（通关/失败/全通关）"
```

---

## Chunk 5: Schulte.tsx 集成

> **前置依赖（必须已完成 Chunk 1-4）：**
> - `src/lib/schulteQuestConfig.ts` 已导出 `SCHULTE_QUEST_LEVELS`、`getLevelConfig`、`computeStars`、`computeScore`、`generateMixedSequence`（Task 3）
> - `src/db/queries.ts` 已导出 `getQuestProgress`、`saveQuestProgress`、`createInitialProgress`（Task 4）
> - `src/components/game/SchulteGrid.tsx` 已重构为 props 形式：接受 `gridSize / order / expectedSequence / isActive / startTime / onCorrectClick / onWrongClick / onComplete / onComboChange`（Task 6）
> - `QuestLevelIntro`、`QuestHUD`、`QuestResultDialog` 已创建并从 `src/components/game/index.ts` 导出（Task 7-9）
>
> **重要约束：**
> - 闯关模式**不**使用 `GameControlBar`。GameControlBar 在 `status !== 'playing' && status !== 'paused'` 时返回 null（line 70-72），而 SchulteQuest 不驱动全局 `useGameStore().status`。直接在页面内渲染轻量 header。
> - 闯关模式**不**写入 `trainingRecords`。所有进度只走 `schulteQuestProgress` 表。

### Task 10: Schulte.tsx 入口（mode 选择 + 进度弹窗）

**Files:**
- Modify: `src/pages/games/Schulte.tsx`

- [ ] **Step 1: 设计入口数据流**

打开 `src/pages/games/Schulte.tsx`，在现有 `Schulte` 函数外新建一个 `SchulteEntry` 组件，负责 mode 选择。

入口状态机：

```
mode === null → 显示两个按钮：自由练习 / 闯关模式
                ↓ 点击自由练习 → mode = 'free'
                ↓ 点击闯关模式 → 查询 progress → 显示进度弹窗
                                              ↓ 继续 → mode = 'quest', questLevel = inProgressLevel ?? clearedLevel+1
                                              ↓ 重新 → mode = 'quest', questLevel = 1
mode === 'free' → 渲染原 SchulteFree 组件
mode === 'quest' → 渲染 SchulteQuest（Task 11 实现）
```

- [ ] **Step 2: 在 Schulte.tsx 顶部加入新导入和状态**

```typescript
// 新增 imports
import { useState as useReactState, useEffect as useReactEffect } from 'react';
import { QuestLevelIntro, QuestHUD, QuestResultDialog } from '../../components/game';
import { getQuestProgress, saveQuestProgress } from '../../db/queries';
import {
  SCHULTE_QUEST_LEVELS,
  getLevelConfig,
  computeStars,
  computeScore,
  generateMixedSequence,
} from '../../lib/schulteQuestConfig';
import type { SchulteQuestProgress } from '../../types';
```

（保留现有 imports）

- [ ] **Step 3: 把现有 Schulte 函数重命名为 SchulteFree**

把 `export function Schulte()` 改为 `function SchulteFree()`（不再 export）。这是自由模式实现，保持原逻辑。

- [ ] **Step 4: 新增 SchulteEntry 顶层组件**

在 Schulte.tsx 文件末尾追加：

```typescript
type Mode = 'free' | 'quest' | null;

export function Schulte() {
  const [mode, setMode] = useState<Mode>(null);
  const [progress, setProgress] = useState<SchulteQuestProgress | null>(null);
  const [showEntryDialog, setShowEntryDialog] = useState(false);

  // 挂载时立刻加载进度（入口页副标题需要显示真实状态，而不是 fallback 文案）
  useEffect(() => {
    getQuestProgress().then(setProgress);
  }, []);

  const handleQuestClick = () => {
    const p = progress ?? createInitialProgress();
    // 三种入口分支：
    //   全新玩家（无进度）→ 直接进入第 1 关，不显示弹窗
    //   其他（有 inProgressLevel、有已通关记录、已全通关）→ 显示弹窗让用户选
    if (!p.inProgressLevel && p.clearedLevel === 0) {
      setMode('quest');
    } else {
      setShowEntryDialog(true);
    }
  };

  // 入口页：mode 选择
  if (mode === null) {
    return (
      <div className="max-w-md mx-auto px-6 pt-8 pb-32">
        <h1 className="font-headline text-3xl font-extrabold mb-6 text-center">舒尔特表</h1>
        <div className="space-y-3">
          <button
            onClick={() => setMode('free')}
            className="w-full p-5 bg-surface rounded-2xl editorial-shadow hover:bg-accent transition-all text-left"
          >
            <div className="font-bold text-base mb-1">自由练习</div>
            <div className="text-xs text-muted-foreground">5×5 网格 · 无压力</div>
          </button>
          <button
            onClick={handleQuestClick}
            className="w-full p-5 bg-surface rounded-2xl editorial-shadow hover:bg-accent transition-all text-left"
          >
            <div className="font-bold text-base mb-1">闯关模式</div>
            <div className="text-xs text-muted-foreground">
              {progress && (progress.clearedLevel > 0 || progress.inProgressLevel)
                ? `进度：第 ${progress.inProgressLevel ?? progress.clearedLevel + 1} 关 · ⭐ ${progress.totalStars}/30`
                : '10 关挑战 · 连击 + 星级'}
            </div>
          </button>
        </div>

        {showEntryDialog && progress && (
          <EntryDialog
            progress={progress}
            onContinue={() => {
              setShowEntryDialog(false);
              setMode('quest');
            }}
            onRestart={async () => {
              const updated: SchulteQuestProgress = {
                ...progress,
                inProgressLevel: 1,
              };
              await saveQuestProgress(updated);
              setProgress(updated);
              setShowEntryDialog(false);
              setMode('quest');
            }}
          />
        )}
      </div>
    );
  }

  if (mode === 'free') {
    return <SchulteFree onExit={() => setMode(null)} />;
  }

  return <SchulteQuest initialProgress={progress} onExit={() => setMode(null)} />;
}

function EntryDialog({
  progress,
  onContinue,
  onRestart,
}: {
  progress: SchulteQuestProgress;
  onContinue: () => void;
  onRestart: () => void;
}) {
  const isCompleted = progress.clearedLevel === 10 && !progress.inProgressLevel;
  const continueLevel = progress.inProgressLevel ?? progress.clearedLevel + 1;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        {isCompleted ? (
          <>
            <h3 className="text-center text-xl font-extrabold mb-2">🏆 全部通关</h3>
            <p className="text-center text-sm text-muted-foreground mb-4">
              已通关全部 10 关 · ⭐ {progress.totalStars}/30
            </p>
          </>
        ) : (
          <>
            <h3 className="text-center text-xl font-extrabold mb-2">继续闯关</h3>
            <p className="text-center text-sm text-muted-foreground mb-4">
              当前进度：第 {continueLevel} 关 · ⭐ {progress.totalStars}/30
            </p>
          </>
        )}
        <div className="flex gap-3">
          {!isCompleted && (
            <button
              onClick={onContinue}
              className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold"
            >
              继续闯关
            </button>
          )}
          <button
            onClick={onRestart}
            className="flex-1 py-3 bg-accent text-foreground rounded-xl font-bold"
          >
            {isCompleted ? '重新挑战' : '重新闯关'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 修改 SchulteFree 接受 onExit prop**

把 `function SchulteFree()` 改为 `function SchulteFree({ onExit }: { onExit: () => void })`。

GameControlBar 的内部 `handleExit` 是 `navigate('/')`（退出到首页），无法直接复用为"返回入口"。因此 SchulteFree 在 idle 状态下渲染独立的"返回入口"按钮，playing/paused 状态下保留 GameControlBar 原行为不变：

```typescript
function SchulteFree({ onExit }: { onExit: () => void }) {
  // ...原有逻辑（保留 useGameStore、计时器、handleComplete 等）

  return (
    <>
      <GameControlBar
        title="舒尔特表 · 自由练习"
        showTimer={isPlaying}
        elapsedTime={Math.floor(elapsedTime)}
      />

      <div className="max-w-md mx-auto px-6 pt-8 pb-32">
        {/* 原有内容（idle 时显示开始按钮 / playing 时显示网格 / 完成时显示结果）*/}

        {/* idle 状态下额外渲染返回入口按钮 */}
        {!isPlaying && !showResult && (
          <button
            onClick={onExit}
            className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← 返回模式选择
          </button>
        )}
      </div>
    </>
  );
}
```

> 注：不要修改 GameControlBar.tsx。它依赖 `useBlocker` + `useGameStore().status`，跨模式扩展 onBack 会牵动暂停/退出语义，本次不重构。

- [ ] **Step 6: 添加 SchulteQuest 占位组件（避免 Task 10 tsc 报错）**

SchulteEntry 在 quest 分支渲染 `<SchulteQuest />`，但完整实现在 Task 11。为保证 Task 10 的 tsc 检查通过，先在 Schulte.tsx 末尾加一个最小占位：

```typescript
// 占位：Task 11 替换为完整状态机实现
function SchulteQuest({ onExit }: { initialProgress: SchulteQuestProgress | null; onExit: () => void }) {
  return (
    <div className="max-w-md mx-auto px-6 pt-8 pb-32 text-center">
      <p className="text-muted-foreground">闯关模式即将上线</p>
      <button onClick={onExit} className="mt-4 text-sm text-primary">← 返回</button>
    </div>
  );
}
```

- [ ] **Step 7: TypeScript 检查**

```bash
cd brain-train && pnpm exec tsc -b --noEmit
```

Expected: 无错误。SchulteQuest 已有占位实现，类型链完整闭合。

- [ ] **Step 8: 提交**

```bash
git add src/pages/games/Schulte.tsx
git commit -m "✨ Schulte.tsx 新增 mode 入口和进度弹窗（自由/闯关）"
```

---

### Task 11: SchulteQuest 组件（闯关状态机）

**Files:**
- Modify: `src/pages/games/Schulte.tsx`

- [ ] **Step 1: 在 Schulte.tsx 中实现 SchulteQuest**

删除 Task 10 末尾的占位 SchulteQuest，替换为完整实现。状态机：

```
intro → playing → pass（弹窗）→ next（intro 下一关）
                  → fail（弹窗）→ retry（intro 当前关） / exit
       → timeout → fail
       → lives===0 → fail
```

**关键设计决策：**

1. **handleFail / handleComplete 必须放在所有 effect 之前**声明，并使用 `useCallback` 包裹完整依赖。这避免了"在 effect 中调用尚未声明的函数"以及"闭包捕获陈旧值"两类 bug。
2. **失败时的"关卡进度"用 `correctClickCount`**（来自 SchulteGrid 的 `onCorrectClick` 回调），而不是用 maxCombo 近似。
3. **全通关总用时**从 `progress.levelRecords` 累加 bestTime 得出，不留 TODO。
4. **不使用 GameControlBar**：它依赖全局 gameStore.status，quest 模式不驱动该 store。改为页面内联 header（仅一个返回按钮 + 标题）。

```typescript
import { useCallback as useCallbackAlias, useRef } from 'react';
// 在 Schulte.tsx 顶部追加（保留现有 imports）：
// import { useCallback, useRef } from 'react';

type QuestPhase = 'intro' | 'playing' | 'pass' | 'fail' | 'completed';

interface SchulteQuestProps {
  initialProgress: SchulteQuestProgress | null;
  onExit: () => void;
}

function SchulteQuest({ initialProgress, onExit }: SchulteQuestProps) {
  // 当前关卡（继续时从 inProgressLevel，否则从 clearedLevel+1，再否则 1）
  const startLevel = initialProgress?.inProgressLevel
    ?? (initialProgress && initialProgress.clearedLevel < 10
        ? initialProgress.clearedLevel + 1
        : 1);
  const [currentLevel, setCurrentLevel] = useState(startLevel);

  const [phase, setPhase] = useState<QuestPhase>('intro');
  const [progress, setProgress] = useState<SchulteQuestProgress>(
    initialProgress ?? createInitialProgress()
  );

  // 游戏运行时状态
  const [gameStartTime, setGameStartTime] = useState(0);
  const [errors, setErrors] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [correctClickCount, setCorrectClickCount] = useState(0);
  const [lives, setLives] = useState(3);
  const [remainingTime, setRemainingTime] = useState<number | undefined>(undefined);
  const [lastResult, setLastResult] = useState<{
    stars: 0 | 1 | 2 | 3;
    score: number;
    completionTime: number;
    progressText?: string;
  } | null>(null);

  // refs：保存本次 playing 阶段最新值，供 timer/wrong-click 等 effect 读取，避免 stale closure
  const failGuardRef = useRef(false);  // 防止 fail 被多次触发

  const config = getLevelConfig(currentLevel);
  if (!config) return null;

  const totalTime = config.timeLimitPerNumber
    ? config.timeLimitPerNumber * config.gridSize * config.gridSize
    : undefined;
  const N = config.gridSize * config.gridSize;

  // 失败处理：先定义，所有 effect/handler 都引用它
  const handleFail = useCallback(() => {
    if (failGuardRef.current) return;
    failGuardRef.current = true;

    const completionTime = gameStartTime > 0 ? (Date.now() - gameStartTime) / 1000 : 0;
    const progressText = `${Math.min(correctClickCount, N)}/${N}`;
    setLastResult({
      stars: 0,
      score: 0,
      completionTime,
      progressText,
    });
    setPhase('fail');
  }, [gameStartTime, correctClickCount, N]);

  // 通关处理：依赖当前所有计分输入
  const handleComplete = useCallback(() => {
    if (failGuardRef.current) return;

    const completionTime = (Date.now() - gameStartTime) / 1000;
    const stars = computeStars({
      passed: true,
      maxCombo,
      errorCount: errors,
      comboTarget: config.comboTarget,
    });
    const score = computeScore({
      level: currentLevel,
      timeLimitPerNumber: config.timeLimitPerNumber,
      gridSize: config.gridSize,
      maxCombo,
      remainingTime: remainingTime ?? 0,
    });

    // 更新进度（取最高星数）
    const oldStars = progress.levelRecords[currentLevel]?.stars ?? 0;
    const newRecords = { ...progress.levelRecords };
    if (stars > oldStars) {
      newRecords[currentLevel] = {
        stars,
        bestScore: Math.max(score, progress.levelRecords[currentLevel]?.bestScore ?? 0),
        bestCombo: Math.max(maxCombo, progress.levelRecords[currentLevel]?.bestCombo ?? 0),
        bestTime: Math.min(completionTime, progress.levelRecords[currentLevel]?.bestTime ?? Infinity),
      };
    }
    const newClearedLevel = Math.max(progress.clearedLevel, currentLevel);
    const newTotalStars = progress.totalStars + (stars - oldStars);
    const isLast = currentLevel === 10;

    const updated: SchulteQuestProgress = {
      ...progress,
      clearedLevel: newClearedLevel,
      totalStars: newTotalStars,
      levelRecords: newRecords,
      inProgressLevel: isLast ? undefined : currentLevel + 1,
    };
    setProgress(updated);
    saveQuestProgress(updated);

    setLastResult({ stars, score, completionTime });
    setPhase(isLast ? 'completed' : 'pass');
  }, [gameStartTime, maxCombo, errors, config, currentLevel, remainingTime, progress]);

  // 进入关卡 intro 时持久化 inProgressLevel
  useEffect(() => {
    if (phase !== 'intro') return;
    failGuardRef.current = false;  // 每关重置 guard
    const updated: SchulteQuestProgress = {
      ...progress,
      inProgressLevel: currentLevel,
    };
    setProgress(updated);
    saveQuestProgress(updated);
  }, [phase, currentLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  // 计时器：仅 playing + 有时限时启用；remainingTime <= 0 时切到 fail
  useEffect(() => {
    if (phase !== 'playing' || !config.timeLimitPerNumber || remainingTime === undefined) return;

    if (remainingTime <= 0) {
      handleFail();
      return;
    }

    const interval = setInterval(() => {
      setRemainingTime((prev) => (prev !== undefined ? Math.max(0, prev - 0.1) : prev));
    }, 100);

    return () => clearInterval(interval);
  }, [phase, remainingTime, config.timeLimitPerNumber, handleFail]);

  const handleStart = () => {
    setGameStartTime(Date.now());
    setErrors(0);
    setCombo(0);
    setMaxCombo(0);
    setCorrectClickCount(0);
    setLives(config.lives);
    setRemainingTime(totalTime);
    failGuardRef.current = false;
    setPhase('playing');
  };

  const handleWrongClick = () => {
    if (failGuardRef.current) return;
    setErrors((prev) => prev + 1);
    const newLives = lives - 1;
    setLives(newLives);
    if (newLives <= 0) {
      handleFail();
    }
  };

  const handleComboChange = (newCombo: number) => {
    setCombo(newCombo);
    setMaxCombo((prev) => Math.max(prev, newCombo));
  };

  const handleCorrectClick = () => {
    setCorrectClickCount((prev) => prev + 1);
  };

  const handleNext = () => {
    setCurrentLevel((prev) => Math.min(10, prev + 1));
    setLastResult(null);
    setPhase('intro');
  };

  const handleRetry = () => {
    setLastResult(null);
    setPhase('intro');
  };

  // 全通关总用时（秒）：累加各关 bestTime
  const totalClearedTime = Object.values(progress.levelRecords).reduce(
    (sum, rec) => sum + (rec?.bestTime ?? 0),
    0
  );

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-32">
      {/* 轻量 header（不使用 GameControlBar） */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onExit}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="text-lg">←</span>
          <span>退出</span>
        </button>
        <span className="font-headline text-base font-extrabold">
          舒尔特闯关 · 第 {currentLevel} 关
        </span>
        <span className="w-12" />
      </div>

      {phase === 'intro' && (
        <QuestLevelIntro level={currentLevel} onStart={handleStart} />
      )}

      {phase === 'playing' && (
        <>
          <QuestHUD
            level={currentLevel}
            direction={config.direction}
            lives={lives}
            combo={combo}
            remainingTime={remainingTime}
            totalTime={totalTime}
          />
          <SchulteGrid
            gridSize={config.gridSize}
            order={config.direction}
            expectedSequence={
              config.direction === 'mixed'
                ? generateMixedSequence(config.gridSize, gameStartTime)
                : undefined
            }
            isActive={true}
            startTime={gameStartTime}
            onCorrectClick={handleCorrectClick}
            onWrongClick={handleWrongClick}
            onComplete={handleComplete}
            onComboChange={handleComboChange}
          />
        </>
      )}

      {phase === 'pass' && lastResult && (
        <QuestResultDialog
          type="pass"
          level={currentLevel}
          stars={lastResult.stars}
          score={lastResult.score}
          maxCombo={maxCombo}
          completionTime={lastResult.completionTime}
          isLastLevel={false}
          onNext={handleNext}
          onRetry={handleRetry}
        />
      )}

      {phase === 'fail' && lastResult && (
        <QuestResultDialog
          type="fail"
          level={currentLevel}
          maxCombo={maxCombo}
          progressText={lastResult.progressText ?? ''}
          onRetry={handleRetry}
          onExit={onExit}
        />
      )}

      {phase === 'completed' && (
        <QuestResultDialog
          type="completed"
          totalStars={progress.totalStars}
          totalTime={totalClearedTime}
          onRestart={handleRetry}
        />
      )}
    </div>
  );
}
```

注意：
- `createInitialProgress` 从 `../../db/queries` 导入（Chunk 2 Task 4 已新增）。
- `QuestLevelIntro`、`QuestHUD`、`QuestResultDialog`、`SchulteGrid` 从 `../../components/game` 导入。
- SchulteGrid 的 props 形态由 Chunk 3 Task 6 决定；若实际签名与此处有出入，以 Chunk 3 为准并相应调整。

- [ ] **Step 2: TypeScript 检查**

```bash
cd brain-train && pnpm exec tsc -b --noEmit
```

Expected: 无错误

- [ ] **Step 3: 启动 dev server 手动验证基础流程**

```bash
cd brain-train && pnpm dev
```

打开浏览器，导航到 `/games/schulte`：
- 看到两个按钮（自由练习 / 闯关模式）
- 点"闯关模式" → 直接进入第 1 关规则说明卡（无进度时）
- 点"开始" → 进入 3×3 正向游戏
- 完成 9 个数字 → 通关弹窗
- 点"下一关" → 第 2 关规则说明卡

如有问题，调试后修复。

- [ ] **Step 4: 验证时限关卡路径（**重要：触发 handleFail 的关键路径**）**

直接修改 `startLevel`（临时改为 `const startLevel = 5;`），或在 dev 环境通关到第 5 关，确保覆盖：

- [ ] 第 5 关有时限（HUD 显示倒计时）
- [ ] 不点任何格子直到时间耗尽 → 自动切到 fail 弹窗（验证 timer effect 正确触发 handleFail）
- [ ] fail 弹窗的"关卡进度"显示正确的 `correctClickCount/N`（不是 NaN 或 0/N）
- [ ] 点"重试本关" → 回到规则说明卡，能再次正常进入游戏（验证 failGuardRef 已重置）
- [ ] 在第 9 关（1 命）故意点错一次 → 立即 fail（验证 wrong-click 触发 handleFail）
- [ ] 验证 handleFail 不会被重复触发（一次 fail 只显示一个弹窗）

- [ ] **Step 5: 运行单元测试**

```bash
cd brain-train && pnpm test tests/unit/
```

Expected: 所有单元测试通过（Chunk 5 未新增测试，仅确认 Chunk 1-4 测试未回归）

- [ ] **Step 6: 提交**

```bash
git add src/pages/games/Schulte.tsx
git commit -m "✨ Schulte.tsx 实现 SchulteQuest 闯关状态机"
```

---

## Chunk 6: 验证与收尾

### Task 12: 手动 E2E 验证

**Files:**
- 无文件改动，纯验证

- [ ] **Step 1: 启动 dev server**

```bash
cd brain-train && pnpm dev
```

- [ ] **Step 2: 验证自由模式回归**

打开 `http://localhost:5173/games/schulte`：
- [ ] 看到两个按钮入口
- [ ] 点"自由练习" → 进入原 5×5 舒尔特游戏
- [ ] 完成一局 → 显示得分（0-100）→ "再玩一次"按钮可用
- [ ] 点"← 返回" → 回到入口

- [ ] **Step 3: 验证闯关模式全新流程**

- [ ] 点"闯关模式" → 直接进入第 1 关规则说明卡（无 inProgressLevel 时）
- [ ] 规则说明卡显示：第 1 关 / 3×3 / 正向 / 3 命 / ⭐ combo ≥ 8
- [ ] 点"开始" → 进入游戏
- [ ] HUD 显示：L1 · 正向 / 3 个 ❤ / 无时间条（第 1 关无时限）
- [ ] 按顺序点 1-9 → 通关弹窗
- [ ] 弹窗显示星数、得分、combo
- [ ] 点"下一关" → 第 2 关规则说明卡

- [ ] **Step 4: 验证 Combo 系统**

- [ ] 在第 5 关（有时限）开始游戏
- [ ] 连续正确点击 5 次 → combo 显示 ×5（角落放大）
- [ ] 继续到 10 次 → 屏幕中央弹"COMBO ×2!"
- [ ] 故意点错一次 → combo 清零，扣 1 命
- [ ] 时间条 < 25% 时变红

- [ ] **Step 5: 验证失败流程**

- [ ] 在第 9 关（1 命）故意点错 → 立即失败弹窗
- [ ] 弹窗显示进度（如 12/36）和最高 combo
- [ ] 点"重试本关" → 回到规则说明卡
- [ ] 点"退出" → 回到入口
- [ ] 入口显示进度："第 9 关"

- [ ] **Step 6: 验证进度持久化**

- [ ] 通关第 1-3 关
- [ ] 在第 4 关退出
- [ ] 刷新页面
- [ ] 回到入口 → 看到"进度：第 4 关 · ⭐ X/30"
- [ ] 点"继续闯关" → 直接进入第 4 关规则说明卡

- [ ] **Step 7: 验证重新闯关**

- [ ] 在入口点"重新闯关" → 进入第 1 关
- [ ] 已通关的关的星数保留

- [ ] **Step 8: 验证全通关（可选，需要时间）**

- [ ] 通关第 1-10 关
- [ ] 第 10 关通关后 → 全通关庆典弹窗
- [ ] 显示总星数 / 总用时
- [ ] 点"重新挑战" → 回到第 1 关，星数保留

- [ ] **Step 9: 验证旧数据兼容**

打开浏览器 DevTools → Application → IndexedDB → BrainTrainDB → trainingRecords
- [ ] 如果有旧的 schulte 记录（无 mode 字段），打开统计页 /stats 应该正常显示
- [ ] 不应有 JavaScript 错误

- [ ] **Step 10: 移动端尺寸验证**

DevTools 切换到移动端视图（iPhone SE 375×667）：
- [ ] 6×6 网格在第 8-10 关可正常显示，数字不溢出
- [ ] HUD 在小屏不挤压

如发现问题，回到对应 Task 修复。

- [ ] **Step 11: 提交最终状态**

```bash
git status
# 确认无未提交改动（或仅有意保留的改动）
```

---

### Task 13: 更新 gameplayInstructions.ts

**Files:**
- Modify: `src/lib/gameplayInstructions.ts`

- [ ] **Step 1: 在文件末尾追加闯关模式说明**

打开 `src/lib/gameplayInstructions.ts`，在 `gameplayInstructionsMap` 之前追加。

> **类型说明：** `TrainingMode` 当前是 `'schulte' | 'stroop' | 'sequence' | 'bottle'`，与 `TrainingRecord.mode` 强绑定。本计划规定**闯关模式不写 trainingRecords**（详见 spec §6.1），因此**不要**把 `'schulte-quest'` 加入 `TrainingMode` 联合类型——那会污染记录层。改用独立的字面量类型 + 独立接口。

```typescript
// 舒尔特闯关模式说明
// 与 GameplayInstructionsConfig 形状相同，但 mode 字面量不在 TrainingMode 联合中（闯关不入 trainingRecords）
export interface QuestGameplayInstructions {
  mode: 'schulte-quest';
  title: string;
  description: string;
  objective: string;
  howToPlay: string[];
  scoringRules: string[];
  hardModeNote: string;
}

export const schulteQuestInstructions: QuestGameplayInstructions = {
  mode: 'schulte-quest',
  title: '舒尔特闯关',
  description: 'Roguelike 风格的舒尔特表挑战 - 10 关递进，combo 加成，星级评价',
  objective: '通过 10 个难度递增的关卡，每关达成星级目标（通关 / combo / 零错误）。',
  howToPlay: [
    '点击舒尔特卡片上的"闯关模式"按钮',
    '选择"继续闯关"或"重新闯关"',
    '查看本关规则说明卡（网格、方向、时限、命数、星级目标）',
    '点击"开始"进入游戏',
    '按规则点击数字，连续正确获得 combo 倍率',
    '通关后自动进入下一关；失败可重试当前关',
  ],
  scoringRules: [
    '基础分 = 100 × 关卡序号',
    '时间奖励 = 剩余秒数 × 5（仅有时限关卡）',
    'combo 倍率：5+ → ×1.5，10+ → ×2.0，20+ → ×3.0，50+ → ×5.0',
    '星级：通关 1 星，combo 达标 +1 星，零错误 +1 星',
  ],
  hardModeNote: '第 9-10 关为一击死亡（1 命）+ 6×6 网格 + 3s/数字 + mixed 方向。',
};
```

- [ ] **Step 2: 将闯关说明注册到 gameplayInstructionsMap**

`gameplayInstructionsMap` 当前类型是 `Record<string, GameplayInstructionsConfig>`。`schulteQuestInstructions` 的类型虽然形状相同，但 `mode` 字面量不同，TS 会拒绝直接放入。

两种解决方式（二选一）：

**方式 A（推荐）：放宽 map 的值类型为 union**

```typescript
export const gameplayInstructionsMap: Record<
  string,
  GameplayInstructionsConfig | QuestGameplayInstructions
> = {
  schulte: schulteInstructions,
  stroop: stroopInstructions,
  sequence: sequenceInstructions,
  bottle: bottleInstructions,
  'schulte-quest': schulteQuestInstructions,
};
```

**方式 B：保持 map 严格类型，仅独立导出 schulteQuestInstructions**

不改 `gameplayInstructionsMap`（保持 4 个原 mode），消费者通过直接 import 使用 `schulteQuestInstructions`。如果未来需要在 UI 上动态查找（如通过 mode 字符串），再切到方式 A。

> 推荐方式 A，因为后续任何"通过 mode 字符串查说明"的逻辑都能统一走 map。

- [ ] **Step 3: TypeScript 检查**

```bash
cd brain-train && pnpm exec tsc -b --noEmit
```

Expected: 无错误（如果选方式 A，确认 union 类型兼容；如果选方式 B，确认 map 类型未变）

- [ ] **Step 4: 提交**

```bash
git add src/lib/gameplayInstructions.ts
git commit -m "📝 新增舒尔特闯关模式玩法说明"
```

---

## Final Checklist

完成所有 Task 后，运行最终验证：

- [ ] **TypeScript**: `cd brain-train && pnpm exec tsc -b --noEmit` — 无错误
- [ ] **Lint**: `cd brain-train && pnpm lint` — 无错误（warning 可接受）
- [ ] **Tests**: `cd brain-train && pnpm test` — 全部通过
- [ ] **Build**: `cd brain-train && pnpm build` — 构建成功
- [ ] **手动验证**: Task 12 所有项目通过

如全部通过，本计划完成。如发现问题，回到对应 Task 修复。

---

## 实现完成后

实现完成后，建议：
1. 创建 PR 到 main 分支（或合并到 main）
2. 在 PR 描述里附上设计文档链接和 spec review 结论
3. 部署到 staging 环境验证 PWA 缓存策略（v3 schema 升级在旧客户端上的行为）

后续阶段（不在本计划内）：
- 阶段 2：破纪录挑战（每日挑战 + 个人最佳）
- 阶段 3：成就系统（徽章）
- 阶段 4：扩展到其他游戏（字色干扰、序列记忆、暗瓶排列）
- 阶段 5：音效升级
