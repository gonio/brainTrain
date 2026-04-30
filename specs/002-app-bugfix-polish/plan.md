# Implementation Plan: 应用问题修复与优化

**Branch**: `002-app-bugfix-polish` | **Date**: 2026-03-29 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-app-bugfix-polish/spec.md`

## Summary

修复并优化专注力训练Web应用的9项问题：主题切换功能、中文本地化、首页数据真实性、用户资料编辑、小游戏交互优化和功能修复。这是一个代码修复和优化性质的feature，不涉及新的技术选型或架构变更。

## Technical Context

**Language/Version**: TypeScript 5.x + React 19
**Primary Dependencies**: React, Vite, Tailwind CSS, shadcn/ui, Zustand, Dexie.js, Framer Motion, Howler.js
**Storage**: IndexedDB (via Dexie.js)
**Testing**: Vitest + React Testing Library
**Target Platform**: Web (Chrome 90+, Safari 14+, Firefox 88+, Edge 90+)
**Project Type**: PWA (Progressive Web App)
**Performance Goals**: 首屏加载 < 2秒，游戏交互 60fps，Lighthouse 评分 > 90
**Constraints**: 纯前端、离线可用、响应式设计、PWA 可安装
**Scale/Scope**: 修复现有功能，不涉及新增游戏模块

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Status**: ✅ 通过

**Checks**:
- ✅ 项目复杂度适中（单页 PWA 应用修复）
- ✅ 技术栈已确定且稳定（继承自 001-focus-training-app）
- ✅ 无新的技术选型需求
- ✅ 代码修复符合最佳实践原则

**Post-Design Re-check**: ✅ 通过 - 修复方案符合项目规模，无过度工程

## Project Structure

### Documentation (this feature)

```text
specs/002-app-bugfix-polish/
├── plan.md              # This file (/speckit.plan command output)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (brain-train/)

```text
brain-train/
├── src/
│   ├── components/         # 通用组件
│   │   ├── ui/             # shadcn/ui 组件
│   │   ├── layout/         # 布局组件
│   │   │   ├── AppLayout.tsx      # 应用布局 - 需修改导航控制
│   │   │   ├── GameLayout.tsx     # 游戏布局 - 需修改导航隐藏逻辑
│   │   │   └── NavBar.tsx         # 导航栏 - 需检查文本本地化
│   │   └── game/           # 游戏通用组件
│   │       ├── GameContainer.tsx  # 游戏容器 - 需添加暂停/退出功能
│   │       └── GamePauseDialog.tsx # 新增：游戏暂停对话框
│   ├── pages/              # 页面组件
│   │   ├── Home.tsx        # 首页 - 需修复数据展示和问候语
│   │   ├── Profile.tsx     # 个人资料 - 需添加编辑功能
│   │   ├── Settings.tsx    # 设置 - 需修复主题切换
│   │   └── games/          # 7个游戏页面 - 需测试修复功能bug
│   ├── hooks/              # 自定义 Hooks
│   │   ├── useTheme.ts     # 新增/修改：主题管理hook
│   │   ├── useUser.ts      # 新增/修改：用户信息管理
│   │   └── useFullscreen.ts # 新增：全屏控制hook
│   ├── stores/             # Zustand 状态
│   │   ├── userStore.ts    # 用户数据 - 需添加编辑方法
│   │   ├── settingsStore.ts # 设置 - 需修复主题逻辑
│   │   └── gameStore.ts    # 游戏状态 - 需修复bug
│   ├── db/                 # Dexie.js 数据库
│   │   ├── index.ts        # 数据库定义
│   │   └── queries.ts      # 查询方法 - 需验证数据查询正确性
│   ├── lib/                # 工具函数
│   │   ├── utils.ts        # 通用工具
│   │   ├── i18n.ts         # 新增：本地化文本映射
│   │   └── greeting.ts     # 新增：问候语计算
│   └── types/              # TypeScript 类型
│       └── index.ts        # 全局类型定义
├── tests/                  # 测试文件
│   ├── unit/
│   │   ├── hooks/
│   │   └── stores/
│   └── e2e/
│       └── bugfix.spec.ts  # 新增：修复验证测试
└── package.json
```

**Structure Decision**: 基于现有 001-focus-training-app 项目结构进行修复。主要修改集中在 stores（修复主题和用户状态逻辑）、pages（修复首页数据和用户资料编辑）、components/game（优化游戏交互）。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

N/A - 无复杂度违规

## Phase 0: Research Summary

本feature为代码修复性质，无需新技术选型研究。所有技术方案已在 001-focus-training-app 中确定：

| 技术领域 | 选择方案 | 版本 | 状态 |
|---------|---------|------|------|
| 框架 | React + TypeScript | v19 + v5.x | ✅ 已确定 |
| 构建工具 | Vite | v6.x | ✅ 已确定 |
| UI 样式 | Tailwind CSS + shadcn/ui | v4.x | ✅ 已确定 |
| 状态管理 | Zustand | v5.x | ✅ 已确定 |
| 存储 | Dexie.js (IndexedDB) | v4.x | ✅ 已确定 |
| 动画 | Framer Motion | v11.x | ✅ 已确定 |

**无需 [NEEDS CLARIFICATION] 研究。**

## Phase 1: Design Artifacts

- ✅ [data-model.md](data-model.md) - 数据模型验证和补充
- ✅ [quickstart.md](quickstart.md) - 快速开始指南（更新版本）

## Next Steps

Phase 2 任务生成由 `/speckit.tasks` 命令执行。

运行以下命令生成可执行任务列表：
```bash
/speckit.tasks
```
