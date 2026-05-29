# Tasks: 应用精简与统一化改造

**Feature**: 应用精简与统一化改造 (`002-app-bugfix-polish`)
**Branch**: `002-app-bugfix-polish`
**Generated**: 2026-05-28
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## Overview

本次任务覆盖游戏精简（6→3）、规则弹窗机制、评分统一（满分100）和统计从时间改为次数。US1-US6 已在前期完成，本次聚焦 US7 和 US8。

### Task Summary

| 类别 | 任务数 | 说明 |
|------|--------|------|
| Phase 1 - 基础设施 | 2 | 数据库迁移 + settingsStore 扩展 |
| Phase 2 - US7 游戏精简与规则弹窗 | 14 | 删除3游戏 + 创建规则弹窗组件 + 集成到各游戏 |
| Phase 3 - US8 分数统一与次数制统计 | 10 | 新评分算法 + 统计改为次数 |
| Phase 4 - 收尾验证 | 3 | 编译检查 + 构建验证 + 端到端测试 |
| **总计** | **29** | - |

### Dependencies & Execution Order

```
Phase 1 (基础设施)
    │
    ├──► Phase 2 (US7 游戏精简与规则弹窗) ── P1
    │         │
    │         ▼
    ├──► Phase 3 (US8 分数统一与次数制统计) ── P1
    │
    ▼
Phase 4 (收尾验证)
```

**执行策略**:
- Phase 1 为阻塞性基础任务，必须先完成
- Phase 2 和 Phase 3 有弱依赖（Phase 2 删游戏后 Phase 3 改评分），建议顺序执行
- Phase 4 在所有阶段完成后执行

### Parallel Execution Examples

**并行组 1** (Phase 2 内): T004-T010 可并行执行（不同文件）
**并行组 2** (Phase 3 内): T018-T020 可并行执行（不同游戏页面）
**并行组 3** (Phase 3 内): T022-T027 可并行执行（不同页面文件）

---

## Phase 1: 基础设施

**目标**: 数据库迁移 v1→v2（清除所有训练记录），settingsStore 扩展（规则偏好 + 次数目标）

**阻塞性**: 是 - 所有后续阶段依赖此阶段完成

### Tasks

- [x] T001 升级 Dexie 数据库版本 v1→v2，在 upgrade 事务中清除 trainingRecords 和 dailyGoals 表所有数据 `brain-train/src/db/index.ts`
- [x] T002 扩展 settingsStore：新增 `ruleDismissed: Record<string, boolean>` 字段和 `dismissRule(mode)` action，将 `dailyGoalMinutes` 改为 `dailyGoalSessions`（默认 5），新增 `setDailyGoalSessions` action，更新 persist 配置 `brain-train/src/stores/settingsStore.ts`

**Checkpoint**: 数据库迁移成功，settingsStore 新字段可用

---

## Phase 2: US7 - 游戏精简与规则弹窗 (Priority: P1)

**目标**: 删除 3 个游戏，创建游戏开始页面和规则弹窗机制

**独立测试标准**: 首页只显示 3 个游戏卡片，首次进入游戏弹出规则，"不再提示"勾选持久生效，"展示规则"按钮始终可用

### 删除 3 个游戏

- [x] T003 [US7] 删除 6 个游戏文件：`brain-train/src/pages/games/Auditory.tsx`, `brain-train/src/pages/games/Classify.tsx`, `brain-train/src/pages/games/Story.tsx`, `brain-train/src/components/game/AuditoryGame.tsx`, `brain-train/src/components/game/ClassifyGame.tsx`, `brain-train/src/components/game/StoryGame.tsx`
- [x] T004 [P] [US7] 从 types/index.ts 的 TrainingMode 联合类型中移除 `'auditory' | 'classify' | 'story'`，删除 AuditoryDetails/ClassifyDetails/StoryDetails 接口，从 TrainingDetails 联合类型中移除它们 `brain-train/src/types/index.ts`
- [x] T005 [P] [US7] 从 App.tsx 的 games 数组中移除 3 个游戏对象，从路由 children 中移除 3 个路由和 3 个 import `brain-train/src/App.tsx`
- [x] T006 [P] [US7] 从 components/game/index.ts 中移除 AuditoryGame、ClassifyGame、StoryGame 的导出 `brain-train/src/components/game/index.ts`
- [x] T007 [P] [US7] 从 GameCard.tsx 的 modeIcons 和 modeColors Record 中移除 auditory/classify/story 条目 `brain-train/src/components/game/GameCard.tsx`
- [x] T008 [P] [US7] 从 AppLayout.tsx 的 GAME_PATHS 数组中移除 3 个游戏路径 `brain-train/src/components/layout/AppLayout.tsx`
- [x] T009 [P] [US7] 从 gameplayInstructions.ts 中移除 auditoryInstructions/classifyInstructions/storyInstructions 对象和 gameplayInstructionsMap 中对应条目 `brain-train/src/lib/gameplayInstructions.ts`
- [x] T010 [P] [US7] 从 stats.ts、useStats.ts、queries.ts 的 modes 数组中移除 auditory/classify/story，从 Stats.tsx 的 modeNames 和 modeIcons Record 中移除对应条目 `brain-train/src/lib/stats.ts`, `brain-train/src/hooks/useStats.ts`, `brain-train/src/db/queries.ts`, `brain-train/src/pages/Stats.tsx`

### 规则弹窗与游戏开始页面

- [x] T011 [US7] 创建 GameStartScreen 通用组件：接收 mode/title/description/onStart props，展示游戏标题、描述文字、"展示规则"按钮和"开始训练"主按钮；首次进入时若 ruleDismissed[mode] 为 false 则自动弹出规则弹窗（Dialog），弹窗底部有"不再提示"勾选框 `brain-train/src/components/game/GameStartScreen.tsx`
- [x] T012 [US7] 重构 GameInstructions 组件：新增 dialogMode 属性支持弹窗模式，弹窗内展示完整规则（目标、玩法步骤、评分规则）和"不再提示"勾选框 + "知道了"关闭按钮 `brain-train/src/components/game/GameInstructions.tsx`
- [x] T013 [US7] 修改 Schulte.tsx 游戏页面：在 idle 状态渲染 GameStartScreen 替代现有开始界面，移除旧的 GameInstructions 引用（如有），onStart 回调调用 startGame('schulte') `brain-train/src/pages/games/Schulte.tsx`
- [x] T014 [P] [US7] 修改 Stroop.tsx 游戏页面：在 idle 状态渲染 GameStartScreen 替代现有开始界面，移除旧的 GameInstructions 引用，onStart 回调调用 startGame('stroop') `brain-train/src/pages/games/Stroop.tsx`
- [x] T015 [P] [US7] 修改 Sequence.tsx 游戏页面：在 idle 状态渲染 GameStartScreen 替代现有开始界面（保留难度选择器），onStart 回调调用 startGame('sequence') `brain-train/src/pages/games/Sequence.tsx`
- [x] T016 [US7] 更新 gameplayInstructions.ts 中保留 3 个游戏的评分规则文案，确保与新 0-100 分制一致（移除旧的千分制描述） `brain-train/src/lib/gameplayInstructions.ts`

**Checkpoint**: 首页只显示 3 个游戏，进入游戏弹出规则，"不再提示"持久生效

---

## Phase 3: US8 - 分数统一与次数制统计 (Priority: P1)

**目标**: 所有游戏评分统一为 0-100，统计从时间维度改为次数维度

**独立测试标准**: 完成任意游戏后分数在 0-100 范围，统计页所有指标为"次"而非"分钟"，每日目标为"N次"

### 评分算法归一化

- [x] T017 [US8] 替换 Schulte.tsx 评分算法：`accuracy = ((25 - errors) / 25) * 100`，`speed = max(0, 100 - (totalSeconds - 20) * 2)`，`score = min(100, round(accuracy * 0.7 + speed * 0.3))` `brain-train/src/pages/games/Schulte.tsx`
- [x] T018 [P] [US8] 替换 Stroop.tsx 评分算法：`accuracy = (correctCount / 15) * 100`，`speed = max(0, 100 - (avgReactionTime - 300) / 10)`，`score = min(100, round(accuracy * 0.7 + speed * 0.3))` `brain-train/src/pages/games/Stroop.tsx`
- [x] T019 [P] [US8] 替换 Sequence.tsx 评分算法：`accuracy = positionAccuracy * 0.6 + itemAccuracy * 0.4`，`score = min(100, round(accuracy))` `brain-train/src/pages/games/Sequence.tsx`
- [x] T020 [US8] 更新 3 个游戏的结果展示页面：确保分数显示适配 0-100 范围，移除千分制相关的展示逻辑 `brain-train/src/pages/games/Schulte.tsx`, `brain-train/src/pages/games/Stroop.tsx`, `brain-train/src/pages/games/Sequence.tsx`

### 统计从时间改为次数

- [x] T021 [US8] 从 types/index.ts 的 OverallStatistics 和 ModeStatistics 接口中移除 totalTime 字段 `brain-train/src/types/index.ts`
- [x] T022 [US8] 更新 lib/stats.ts：从 calculateOverallStats 和 calculateModeStats 中移除时间计算逻辑，useStats.ts 同步更新 `brain-train/src/lib/stats.ts`, `brain-train/src/hooks/useStats.ts`
- [x] T023 [P] [US8] 更新 Stats.tsx 统计页：将"总训练时长"卡片改为显示训练次数，移除所有分钟维度显示，各模式统计从"分钟"改为"次数" `brain-train/src/pages/Stats.tsx`
- [x] T024 [P] [US8] 更新 Settings.tsx 设置页：每日目标选项从 [10,15,20,30,45,60] 分钟改为 [3,5,8,10,15] 次，标签从"分钟"改为"次"，dailyGoalMinutes 改为 dailyGoalSessions `brain-train/src/pages/Settings.tsx`
- [x] T025 [P] [US8] 更新 BottomNav.tsx 的 TopBar 组件：进度条从"N/M分钟"改为"N/M次"，从 settingsStore 读取 dailyGoalSessions，从 DB 查询今日已完成次数 `brain-train/src/components/layout/BottomNav.tsx`
- [x] T026 [P] [US8] 更新 App.tsx 首页 Home 组件：周数据展示适配次数制（移除时间相关计算），TopBar 进度条显示适配 `brain-train/src/App.tsx`
- [x] T027 [US8] 更新 db/queries.ts：dailyGoal 相关查询适配次数制（completed 从秒数改为次数），gameStore endGame 中 DailyGoal 更新逻辑适配 `brain-train/src/db/queries.ts`, `brain-train/src/stores/gameStore.ts`

**Checkpoint**: 所有游戏分数 0-100，统计全为次数，每日目标为"N次"

---

## Phase 4: 收尾与验证

**目标**: 编译检查、构建验证、端到端测试

**阻塞性**: 是 - 必须在所有用户故事完成后执行

### Tasks

- [x] T028 运行 TypeScript 编译检查 `npx tsc --noEmit`，确保零错误
- [x] T029 运行构建验证 `pnpm run build`，确保构建成功
- [x] T030 端到端手动测试：3 个游戏完整流程（开始→弹窗→训练→0-100分数→保存），首页 3 卡片，统计页次数维度，设置页次数目标，TopBar 进度条

---

## Implementation Strategy

### MVP Scope

**建议 MVP**: Phase 1 + Phase 2（基础设施 + 游戏精简与规则弹窗）

理由：
- 删除冗余游戏是最直观的用户体验提升
- 规则弹窗是全新功能，用户可立即感知
- 独立可测试，不依赖评分和统计改造

### 增量交付建议

1. **第一轮**: Phase 1-2（基础设施 + 游戏精简）- 约 1 天
2. **第二轮**: Phase 3（评分 + 统计改造）- 约 1 天
3. **第三轮**: Phase 4（验证）- 约 0.5 天

### 风险缓解

| 风险 | 缓解措施 |
|------|----------|
| 数据库迁移失败 | Dexie upgrade 事务保证原子性，失败自动回滚 |
| settingsStore 字段重命名导致旧数据丢失 | Zustand persist 的 migrate 函数处理 dailyGoalMinutes → dailyGoalSessions 迁移 |
| 评分算法过于简单导致分数区分度低 | 0.7/0.3 权重经过分析确保合理区分度，后续可调整 |
| 3 个游戏卡片布局不对称 | 保持 2 列 grid，最后一个卡片自然左对齐，视觉上可接受 |

---

## Task ID Quick Reference

| ID | 描述 | 文件路径 |
|----|------|----------|
| T001 | Dexie DB v2 迁移 | `src/db/index.ts` |
| T002 | settingsStore 扩展 | `src/stores/settingsStore.ts` |
| T003 | 删除 6 个游戏文件 | 6 个文件 |
| T004 | 清理 types/index.ts | `src/types/index.ts` |
| T005 | 清理 App.tsx | `src/App.tsx` |
| T006 | 清理 game/index.ts | `src/components/game/index.ts` |
| T007 | 清理 GameCard.tsx | `src/components/game/GameCard.tsx` |
| T008 | 清理 AppLayout.tsx | `src/components/layout/AppLayout.tsx` |
| T009 | 清理 gameplayInstructions.ts | `src/lib/gameplayInstructions.ts` |
| T010 | 清理 stats/useStats/queries/Stats | 4 个文件 |
| T011 | 创建 GameStartScreen | `src/components/game/GameStartScreen.tsx` |
| T012 | 重构 GameInstructions | `src/components/game/GameInstructions.tsx` |
| T013 | Schulte 集成开始页面 | `src/pages/games/Schulte.tsx` |
| T014 | Stroop 集成开始页面 | `src/pages/games/Stroop.tsx` |
| T015 | Sequence 集成开始页面 | `src/pages/games/Sequence.tsx` |
| T016 | 更新评分规则文案 | `src/lib/gameplayInstructions.ts` |
| T017 | Schulte 新评分算法 | `src/pages/games/Schulte.tsx` |
| T018 | Stroop 新评分算法 | `src/pages/games/Stroop.tsx` |
| T019 | Sequence 新评分算法 | `src/pages/games/Sequence.tsx` |
| T020 | 更新结果展示 | 3 个游戏页面 |
| T021 | 移除 totalTime 类型 | `src/types/index.ts` |
| T022 | 更新 stats 计算 | `src/lib/stats.ts`, `src/hooks/useStats.ts` |
| T023 | Stats 页面次数制 | `src/pages/Stats.tsx` |
| T024 | Settings 次数目标 | `src/pages/Settings.tsx` |
| T025 | TopBar 次数进度 | `src/components/layout/BottomNav.tsx` |
| T026 | Home 次数适配 | `src/App.tsx` |
| T027 | queries/gameStore 次数制 | `src/db/queries.ts`, `src/stores/gameStore.ts` |
| T028 | TypeScript 编译检查 | - |
| T029 | 构建验证 | - |
| T030 | 端到端测试 | - |
