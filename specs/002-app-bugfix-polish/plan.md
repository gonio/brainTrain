# Implementation Plan: 应用精简与统一化改造

**Branch**: `002-app-bugfix-polish` | **Date**: 2026-05-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-app-bugfix-polish/spec.md`

## Summary

将专注力训练应用从 6 个游戏精简为 3 个核心训练游戏（舒尔特表、字色干扰、序列记忆），统一评分制为满分 100 分，训练统计从时间维度改为次数维度，新增游戏规则弹窗机制（支持"不再提示"），并新增统一的游戏开始页面（展示开始按钮、描述文字、展示规则按钮）。

## Technical Context

**Language/Version**: TypeScript 5.x + React 19
**Primary Dependencies**: Vite 8, Tailwind CSS 4, shadcn/ui, Zustand, Dexie.js, Framer Motion, Howler.js, React Router v6 (data router)
**Storage**: IndexedDB via Dexie.js (3张表: userProfile, trainingRecords, dailyGoals)
**Testing**: 手动端到端测试 + TypeScript 编译检查
**Target Platform**: PWA (Chrome 90+, Safari 14+, 移动端优先)
**Project Type**: Web 应用 (PWA)
**Performance Goals**: 首屏 < 2秒, 交互帧率 60fps
**Constraints**: 离线可用, IndexedDB 本地存储无后端同步
**Scale/Scope**: 3 个游戏, ~10 个页面, 单用户本地应用

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 状态 | 说明 |
|------|------|------|
| I. 中文优先 | ✅ 通过 | 所有 UI 文本、注释、提交信息使用中文 |
| II. 代码清晰 | ✅ 通过 | 删除冗余代码，简化评分算法 |
| III. 渐进交付 | ✅ 通过 | 按阶段交付：删游戏 → 新评分 → 规则弹窗 → 统计改造 |
| IV. 独立可测 | ✅ 通过 | 每个阶段可独立验证 |
| V. 设计驱动 | ✅ 通过 | 遵循现有设计系统，新增组件保持一致性 |

## Phase 0: Research

### R1 - 评分算法归一化方案

**Decision**: 每个游戏采用"准确度权重 + 速度权重"的加权评分模型，所有分量归一化到 0-100 范围。

**Rationale**:
- 3 个游戏当前评分体系各不相同（Schulte 最高 1250, Stroop 最高 1300, Sequence 最高 1000）
- 加权模型让每个游戏的分数含义一致：准确度是核心，速度是加分
- 权重可按游戏特性调整（记忆类游戏降低速度权重）

**Alternatives considered**:
- 线性映射旧分数到 0-100：不同游戏的"难度曲线"不一致，映射后分数含义模糊
- 纯百分比（正确率）：无法区分速度差异

**Schulte 评分 (5x5 网格, 25 个数字):**
```typescript
const accuracy = ((25 - errors) / 25) * 100;
const speed = Math.max(0, 100 - (totalSeconds - 20) * 2); // 20秒为满分基准
const score = Math.min(100, Math.round(accuracy * 0.7 + speed * 0.3));
```

**Stroop 评分 (15 题):**
```typescript
const accuracy = (correctCount / 15) * 100;
const speed = Math.max(0, 100 - (avgReactionTime - 300) / 10); // 300ms为满分基准
const score = Math.min(100, Math.round(accuracy * 0.7 + speed * 0.3));
```

**Sequence 评分 (记忆类，无速度权重):**
```typescript
const accuracy = positionAccuracy * 0.6 + itemAccuracy * 0.4;
const score = Math.min(100, Math.round(accuracy));
```

### R2 - "不再提示"偏好存储方案

**Decision**: 在 settingsStore 中新增 `ruleDismissed` 字段（类型 `Record<string, boolean>`），随现有 localStorage 持久化机制存储。

**Rationale**: settingsStore 已有 Zustand persist 中间件，无需新增存储机制。

**Alternatives considered**:
- IndexedDB userPreferences 表：需新增 migration，过于复杂
- 每游戏独立 localStorage key：分散管理，不如集中存储

### R3 - 数据迁移方案

**Decision**: 升级 Dexie 数据库版本（v1 → v2），在 upgrade 事务中删除所有 trainingRecords 和 dailyGoals 表数据，删除 auditory/classify/story 的所有记录。

**Rationale**: 评分体系从千分制改为百分制，旧数据无法换算，需完全清除。Dexie versioned upgrade 是标准迁移方式。

**Alternatives considered**:
- 保留旧记录但标记为 legacy：增加代码复杂度，用户只有百条级别记录不值得
- 手动删除再重建数据库：不如 Dexie upgrade 可靠

### R4 - 游戏开始页面设计

**Decision**: 创建通用 `GameStartScreen` 组件，由各游戏页面在 `idle` 状态时渲染。组件包含：游戏标题、简短描述（复用游戏卡片描述文案）、"展示规则"按钮、游戏规则弹窗（Dialog）、"开始训练"按钮。首次进入自动弹出规则弹窗。

**Rationale**: 3 个游戏统一开始页面模式，减少重复代码。规则弹窗复用现有 shadcn Dialog 组件。

**Alternatives considered**:
- 每个游戏独立实现开始页面：重复代码多
- 路由层中间页面：增加导航复杂度

### R5 - 统计从时间改为次数

**Decision**: 所有 `totalTime` / `duration` 展示替换为 `sessions` 计数。每日目标从分钟改为次数（选项: 3/5/8/10/15 次）。TopBar 进度条从"N/M分钟"改为"N/M次"。

**Rationale**: 次数比时间更直观，且不受单次训练时长差异影响。

**Alternatives considered**:
- 同时展示时间和次数：增加 UI 复杂度
- 只在统计页改：不一致，用户会困惑

## Phase 1: Design

### data-model.md

详见 [data-model.md](./data-model.md)

### contracts/

本项目为纯前端 PWA，无外部 API。UI 交互契约详见 [contracts/ui-contracts.md](./contracts/ui-contracts.md)

### quickstart.md

详见 [quickstart.md](./quickstart.md)

## Project Structure

### Documentation (this feature)

```text
specs/002-app-bugfix-polish/
├── plan.md              # 本文件
├── research.md          # Phase 0 输出（研究决策，已整合到本文件 R1-R5）
├── data-model.md        # Phase 1 输出
├── quickstart.md        # Phase 1 输出
├── contracts/           # Phase 1 输出
│   └── ui-contracts.md
├── spec.md              # 功能规格
└── tasks.md             # Phase 2 输出 (/speckit.tasks)
```

### Source Code (repository root)

```text
brain-train/src/
├── App.tsx                          # 路由配置 + 首页 [修改: 删游戏]
├── main.tsx                         # 入口 [不变]
├── types/
│   └── index.ts                     # 类型定义 [修改: 删3游戏类型]
├── db/
│   ├── index.ts                     # Dexie schema [修改: v2迁移]
│   └── queries.ts                   # 查询函数 [修改: 删3游戏]
├── stores/
│   ├── gameStore.ts                 # 游戏状态 [不变]
│   ├── settingsStore.ts             # 设置状态 [修改: 新增ruleDismissed, dailyGoalSessions]
│   └── userStore.ts                 # 用户状态 [不变]
├── lib/
│   ├── stats.ts                     # 统计计算 [修改: 删3游戏]
│   ├── gameplayInstructions.ts      # 游戏指令 [修改: 删3游戏]
│   └── utils.ts                     # 工具函数 [不变]
├── hooks/
│   └── useStats.ts                  # 统计Hook [修改: 删3游戏]
├── components/
│   ├── game/
│   │   ├── GameCard.tsx             # 游戏卡片 [修改: 删3游戏]
│   │   ├── GameControlBar.tsx       # 游戏控制栏 [不变]
│   │   ├── GameStartScreen.tsx      # [新增] 通用游戏开始页面
│   │   ├── GameInstructions.tsx     # 游戏指令展示 [修改: 支持弹窗模式]
│   │   ├── SchulteGrid.tsx          # 舒尔特网格 [不变]
│   │   ├── StroopGame.tsx           # 字色干扰 [不变]
│   │   └── SequenceGame.tsx         # 序列记忆 [不变]
│   ├── layout/
│   │   ├── AppLayout.tsx            # 布局 [修改: 删游戏路径]
│   │   └── BottomNav.tsx            # 底部导航 [修改: TopBar目标改为次数]
│   └── ui/                          # shadcn组件 [不变]
├── pages/
│   ├── Stats.tsx                    # 统计页 [修改: 时间→次数, 删3游戏]
│   ├── Settings.tsx                 # 设置页 [修改: 目标选项改为次数]
│   ├── games/
│   │   ├── Schulte.tsx              # [修改: 新评分+开始页面]
│   │   ├── Stroop.tsx               # [修改: 新评分+开始页面]
│   │   └── Sequence.tsx             # [修改: 新评分+开始页面]
│   └── ...                          # 其他页面 [不变]
└── 删除的文件:
    ├── pages/games/Auditory.tsx
    ├── pages/games/Classify.tsx
    ├── pages/games/Story.tsx
    ├── components/game/AuditoryGame.tsx
    ├── components/game/ClassifyGame.tsx
    └── components/game/StoryGame.tsx
```

**Structure Decision**: 保持现有单项目结构，仅修改和删除文件。

## Implementation Phases

### 阶段 1: 删除 3 个游戏（FR-018 ~ FR-020）

删除 auditory/classify/story 的所有代码、路由和引用，清理数据库中这些游戏的记录。

**涉及文件**: 6 个删除 + 8 个修改
**独立验证**: 首页只显示 3 个游戏卡片，路由不可达已删除游戏，TypeScript 编译无错误

### 阶段 2: 统一评分制为满分 100（FR-026, FR-027）

修改 3 个保留游戏的评分算法，升级数据库版本清除所有历史记录。

**涉及文件**: 3 个游戏页面 + db/index.ts
**独立验证**: 完成任意游戏后得分在 0-100 范围

### 阶段 3: 游戏规则弹窗机制（FR-021 ~ FR-025）

创建 GameStartScreen 组件，实现规则弹窗 + "不再提示" + "展示规则"按钮。

**涉及文件**: 新增 GameStartScreen.tsx，修改 3 个游戏页面 + settingsStore
**独立验证**: 首次进入游戏弹出规则，勾选后不再弹出，展示规则按钮始终可用

### 阶段 4: 统计从时间改为次数（FR-028 ~ FR-030）

修改 Stats 页面、首页洞察区、TopBar 进度条、设置页目标选项，统一以次数为维度。

**涉及文件**: Stats.tsx, Settings.tsx, App.tsx, BottomNav.tsx (TopBar), settingsStore
**独立验证**: 所有统计显示为次数，每日目标为"N次"

## Complexity Tracking

无 Constitution 违规需要记录。
