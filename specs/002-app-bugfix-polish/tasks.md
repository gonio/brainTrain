# Tasks: 应用问题修复与优化

**Feature**: 应用问题修复与优化 (`002-app-bugfix-polish`)
**Branch**: `002-app-bugfix-polish`
**Generated**: 2026-03-29
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## Overview

本次任务列表覆盖专注力训练Web应用的9项问题修复，按用户故事优先级组织。

### Task Summary

| 类别 | 任务数 | 说明 |
|------|--------|------|
| Phase 1 - 环境准备 | 2 | 检查项目状态和依赖 |
| Phase 2 - 基础架构 | 4 | 数据库迁移、状态管理更新、工具函数 |
| Phase 3 - US1 主题切换 | 4 | 主题切换修复和系统跟随 |
| Phase 4 - US2 中文本地化 | 3 | 全应用文本中文化 |
| Phase 5 - US3 首页优化 | 5 | 真实数据、问候语、移除按钮 |
| Phase 6 - US4 用户资料 | 5 | 用户名和头像编辑功能 |
| Phase 7 - US5 游戏交互 | 5 | 导航隐藏、暂停/退出功能 |
| Phase 8 - US6 游戏修复 | 3 | 7个游戏功能测试和修复 |
| Phase 9 - 收尾 | 3 | 最终验证和优化 |
| **总计** | **34** | - |

### Dependencies & Execution Order

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Foundational) ─────────────────┐
    │                                     │
    ├──► Phase 3 (US1 主题)              │
    │                                     │
    ├──► Phase 4 (US2 本地化)            │
    │                                     │
    ├──► Phase 5 (US3 首页)              │
    │         ▲                          │
    │         │                          │
    ├──► Phase 6 (US4 用户资料) ──────────┘
    │
    ├──► Phase 7 (US5 游戏交互)
    │
    ├──► Phase 8 (US6 游戏修复)
    │
    ▼
Phase 9 (Polish)
```

**执行策略**:
- Phase 1-2 为阻塞性任务，必须按顺序完成
- Phase 3-8 各自独立，可并行开发（但建议按优先级顺序）
- Phase 9 在所有用户故事完成后执行

### Parallel Execution Examples

**并行组 1**: Phase 3 + Phase 4
- T011-T014 (主题切换) 可与 T015-T017 (中文本地化) 并行

**并行组 2**: Phase 5 + Phase 6
- T018-T022 (首页优化) 可与 T023-T027 (用户资料) 并行

**并行组 3**: Phase 7 + Phase 8
- T028-T032 (游戏交互) 可与 T033-T035 (游戏修复) 并行

---

## Phase 1: 环境准备

**目标**: 确保开发环境就绪，检查项目状态

### Tasks

- [x] T001 检查项目依赖状态，确认所有npm包已正确安装 `brain-train/package.json`
- [x] T002 验证开发服务器可正常启动 `npm run dev`

---

## Phase 2: 基础架构更新

**目标**: 更新数据库schema和状态管理，为后续用户故事提供基础支持

**阻塞性**: 是 - 所有后续用户故事依赖此阶段完成

### Tasks

- [x] T003 更新数据库schema版本到v2，添加themeMode字段 `brain-train/src/db/index.ts`
- [x] T004 修复settingsStore主题逻辑，支持auto/light/dark三种模式 `brain-train/src/stores/settingsStore.ts`
- [x] T005 更新userStore添加用户资料编辑方法 `brain-train/src/stores/userStore.ts`
- [x] T006 创建问候语计算工具函数 `brain-train/src/lib/greeting.ts`

---

## Phase 3: User Story 1 - 主题切换与系统跟随

**目标**: 修复主题切换功能，默认跟随系统主题

**独立测试标准**: 可独立测试主题切换，验证浅色/深色模式正确应用，系统主题变更时应用自动同步

**优先级**: P1

### Tasks

- [x] T007 [US1] 创建useTheme hook，处理系统主题监听和主题计算逻辑 `brain-train/src/hooks/useTheme.ts`
- [x] T008 [US1] 更新App.tsx应用根组件，集成useTheme初始化主题 `brain-train/src/App.tsx`
- [x] T009 [US1] 修复Settings.tsx设置页面主题切换UI，添加auto/light/dark三选一 `brain-train/src/pages/Settings.tsx`
- [x] T010 [US1] 验证主题持久化，刷新页面后主题选择保持一致

---

## Phase 4: User Story 2 - 全中文本地化

**目标**: 应用内所有文本使用中文，无英文残留

**独立测试标准**: 检查应用内所有可见文本，确保没有英文残留

**优先级**: P1

### Tasks

- [x] T011 [P] [US2] 扫描并替换所有英文文本 - stores目录 `brain-train/src/stores/*`
- [x] T012 [P] [US2] 扫描并替换所有英文文本 - components目录 `brain-train/src/components/*`
- [x] T013 [P] [US2] 扫描并替换所有英文文本 - pages目录 `brain-train/src/pages/*`

---

## Phase 5: User Story 3 - 首页优化与真实数据

**目标**: 首页显示真实训练数据，移除"查看全部"按钮，动态问候语

**独立测试标准**: 验证首页数据展示是否正确反映用户的实际训练记录

**优先级**: P1

### Tasks

- [x] T014 [US3] 创建训练统计查询函数，计算连续天数、平均值等 `brain-train/src/db/queries.ts`
- [x] T015 [US3] 更新Home.tsx首页，集成真实数据展示 `brain-train/src/pages/Home.tsx`
- [x] T016 [US3] 添加空状态提示组件，当无训练记录时友好引导 `brain-train/src/components/EmptyState.tsx`
- [x] T017 [US3] 移除首页训练模式区域的"查看全部"按钮 `brain-train/src/pages/Home.tsx`
- [x] T018 [US3] 集成问候语计算，根据时间段显示不同问候 `brain-train/src/pages/Home.tsx`

---

## Phase 6: User Story 4 - 用户资料编辑

**目标**: 用户可以修改显示名称和头像

**独立测试标准**: 独立测试用户资料编辑功能，验证修改后数据正确保存和显示

**优先级**: P2

### Tasks

- [x] T019 [US4] 创建预设头像组件，显示6个可选头像 `brain-train/src/components/AvatarPicker.tsx`
- [x] T020 [US4] 添加头像上传功能，支持自定义图片 `brain-train/src/components/AvatarUploader.tsx`
- [x] T021 [US4] 创建或更新Profile.tsx用户资料页面，集成编辑功能 `brain-train/src/pages/Profile.tsx`
- [x] T022 [US4] 验证用户信息修改后首页和其他页面实时更新
- [x] T023 [US4] 添加用户资料编辑表单验证（名称长度限制等）

---

## Phase 7: User Story 5 - 小游戏交互优化

**目标**: 游戏过程中隐藏导航，支持暂停和退出

**独立测试标准**: 测试小游戏界面导航隐藏和退出功能

**优先级**: P1

### Tasks

- [x] T024 [US5] 创建GamePauseDialog组件，提供暂停/继续/退出选项 `brain-train/src/components/game/GamePauseDialog.tsx`
- [x] T025 [US5] 更新GameLayout.tsx游戏布局，支持导航栏显隐控制 `brain-train/src/components/layout/GameLayout.tsx`
- [x] T026 [US5] 为所有游戏页面添加暂停功能集成 `brain-train/src/pages/games/*.tsx`
- [x] T027 [US5] 实现游戏退出确认对话框，防止误操作
- [x] T028 [US5] 验证游戏结束后导航栏正常显示恢复

---

## Phase 8: User Story 6 - 小游戏功能修复

**目标**: 修复所有小游戏功能bug，确保逻辑正确

**独立测试标准**: 测试每个小游戏完整流程，确保无功能缺陷

**优先级**: P1

### Tasks

- [x] T029 [P] [US6] 测试并修复舒尔特表(schulte)游戏逻辑和得分计算 `brain-train/src/pages/games/Schulte.tsx`
- [x] T030 [P] [US6] 测试并修复字色干扰(stroop)和序列记忆(sequence)游戏 `brain-train/src/pages/games/Stroop.tsx`, `brain-train/src/pages/games/Sequence.tsx`
- [x] T031 [P] [US6] 测试并修复听觉注意(auditory)、镜像协调(mirror)、分类逻辑(classify)、情景联想(story)游戏 `brain-train/src/pages/games/*.tsx`

---

## Phase 9: 收尾与验证

**目标**: 最终验证和性能优化

**阻塞性**: 是 - 必须在所有用户故事完成后执行

### Tasks

- [x] T032 运行完整应用测试，验证所有修复点正常工作
- [x] T033 检查并清理无用代码和注释
- [x] T034 验证PWA功能正常（离线访问、manifest配置）

---

## Implementation Strategy

### MVP Scope (最小可行产品)

**建议MVP**: Phase 1-3 (环境准备 + 基础架构 + US1 主题切换)

理由：
- 主题切换是用户反馈最突出的问题
- 独立可测试，用户可立即感知改进
- 为后续修复奠定基础

### 增量交付建议

1. **第一轮**: Phase 1-3 (主题修复) - 约 1-2 天
2. **第二轮**: Phase 4-5 (本地化 + 首页) - 约 2-3 天
3. **第三轮**: Phase 6 (用户资料) - 约 1-2 天
4. **第四轮**: Phase 7-9 (游戏优化 + 收尾) - 约 3-4 天

### 风险缓解

| 风险 | 缓解措施 |
|------|----------|
| 数据库迁移失败 | 先备份现有数据，实现回滚机制 |
| 游戏修复耗时超预期 | 优先修复P1严重bug，轻微问题延后 |
| 主题切换浏览器兼容性 | 测试Chrome/Safari/Firefox最新版本 |

---

## Task ID Quick Reference

| ID | 描述 | 文件路径 |
|----|------|----------|
| T001 | 检查项目依赖 | `package.json` |
| T002 | 验证开发服务器 | - |
| T003 | 更新数据库schema | `src/db/index.ts` |
| T004 | 修复settingsStore | `src/stores/settingsStore.ts` |
| T005 | 更新userStore | `src/stores/userStore.ts` |
| T006 | 创建问候语工具 | `src/lib/greeting.ts` |
| T007 | 创建useTheme hook | `src/hooks/useTheme.ts` |
| T008 | 更新App.tsx | `src/App.tsx` |
| T009 | 修复Settings.tsx | `src/pages/Settings.tsx` |
| T010 | 验证主题持久化 | - |
| T011-T013 | 中文本地化 | `src/**/*` |
| T014 | 训练统计查询 | `src/db/queries.ts` |
| T015-T018 | 首页优化 | `src/pages/Home.tsx` |
| T019-T023 | 用户资料编辑 | `src/pages/Profile.tsx` |
| T024-T028 | 游戏交互优化 | `src/components/game/*` |
| T029-T031 | 游戏功能修复 | `src/pages/games/*` |
| T032-T034 | 收尾验证 | - |
