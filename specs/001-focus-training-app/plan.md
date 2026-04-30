# Implementation Plan: 专注力训练Web应用

**Branch**: `001-focus-training-app` | **Date**: 2026-03-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-focus-training-app/spec.md`

## Summary

开发一个基于 React 19 + TypeScript 的专注力训练 PWA 应用，包含7种益智训练模式（舒尔特表、字色干扰、序列记忆、听觉注意、镜像协调、分类逻辑、情景联想）。应用采用现代前端技术栈，支持离线使用，数据存储在 IndexedDB，UI 设计通过 Stitch MCP 生成。

## Technical Context

**Language/Version**: TypeScript 5.x + React 19
**Primary Dependencies**: React, Vite, Tailwind CSS, shadcn/ui, Zustand, Dexie.js, Framer Motion, Howler.js
**Storage**: IndexedDB (via Dexie.js)
**Testing**: Vitest + React Testing Library
**Target Platform**: Web (Chrome 90+, Safari 14+, Firefox 88+, Edge 90+)
**Project Type**: PWA (Progressive Web App)
**Performance Goals**: 首屏加载 < 2秒，游戏交互 60fps，Lighthouse 评分 > 90
**Constraints**: 纯前端、离线可用、响应式设计、PWA 可安装
**Scale/Scope**: 7个游戏模块、单用户、本地存储

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Status**: 项目使用模板 constitution，无强制性约束

**Checks**:
- ✅ 项目复杂度适中（单页 PWA 应用）
- ✅ 技术选择经过研究验证（见 research.md）
- ✅ 数据模型清晰且一致
- ✅ 架构符合最佳实践（React + TypeScript + PWA）

**Post-Design Re-check**: ✅ 通过 - 设计符合项目规模，无过度工程

## Project Structure

### Documentation (this feature)

```text
specs/001-focus-training-app/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── internal.md      # 内部模块接口契约
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
brain-train/
├── index.html              # 入口
├── public/                 # 静态资源
│   ├── manifest.json       # PWA 配置
│   └── icons/              # 图标
├── src/
│   ├── main.tsx            # 应用入口
│   ├── App.tsx             # 根组件
│   ├── components/         # 通用组件
│   │   ├── ui/             # shadcn/ui 组件
│   │   ├── layout/         # 布局组件
│   │   │   ├── AppLayout.tsx
│   │   │   ├── GameLayout.tsx
│   │   │   └── NavBar.tsx
│   │   └── game/           # 游戏通用组件
│   │       ├── ScoreBoard.tsx
│   │       ├── GameplayInstructions.tsx    # 游戏玩法说明弹窗
│   │       ├── GameCard.tsx
│   │       └── Timer.tsx
│   ├── pages/              # 页面组件
│   │   ├── Home.tsx        # 首页/游戏选择
│   │   ├── Stats.tsx       # 统计页面
│   │   ├── Settings.tsx    # 设置页面
│   │   └── games/          # 7个游戏页面
│   │       ├── Schulte.tsx      # 舒尔特表
│   │       ├── Stroop.tsx       # 字色干扰
│   │       ├── Sequence.tsx     # 序列记忆
│   │       ├── Auditory.tsx     # 听觉注意
│   │       ├── Mirror.tsx       # 镜像协调
│   │       ├── Classify.tsx     # 分类逻辑
│   │       └── Story.tsx        # 情景联想
│   ├── hooks/              # 自定义 Hooks
│   │   ├── useTimer.ts     # 计时器
│   │   ├── useAudio.ts     # 音频控制
│   │   ├── useStats.ts     # 统计计算
│   │   └── useGameSession.ts # 游戏会话管理
│   ├── stores/             # Zustand 状态
│   │   ├── userStore.ts    # 用户数据
│   │   ├── gameStore.ts    # 游戏状态
│   │   └── settingsStore.ts # 设置
│   ├── db/                 # Dexie.js 数据库
│   │   ├── index.ts        # 数据库定义
│   │   └── queries.ts      # 查询方法
│   ├── types/              # TypeScript 类型
│   │   └── index.ts        # 全局类型定义
│   ├── lib/                # 工具函数
│   │   └── utils.ts        # 通用工具
│   └── styles/             # 全局样式
│       └── globals.css     # Tailwind 入口
├── tests/                  # 测试文件
│   ├── unit/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── games/
│   └── e2e/
│       └── flows.spec.ts
├── index.html              # HTML 入口
├── vite.config.ts          # Vite 配置 (含 PWA)
├── tsconfig.json           # TypeScript 配置
├── tailwind.config.ts      # Tailwind 配置
├── components.json         # shadcn/ui 配置
└── package.json            # 依赖
```

**Structure Decision**: 采用 Vite + React SPA 结构，按功能模块组织（pages, components, hooks, stores, db）。每个游戏作为独立页面组件，共享通用的游戏布局和组件。PWA 配置通过 Vite PWA 插件自动生成 Service Worker。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

N/A - 无复杂度违规

## Phase 0: Research Summary

已完成技术选型研究，详见 [research.md](research.md)：

| 技术领域 | 选择方案 | 版本 | 状态 |
|---------|---------|------|------|
| 框架 | React + TypeScript | v19 + v5.x | ✅ 已确定 |
| 构建工具 | Vite | v6.x | ✅ 已确定 |
| UI 样式 | Tailwind CSS + shadcn/ui | v4.x | ✅ 已确定 |
| 状态管理 | Zustand | v5.x | ✅ 已确定 |
| 存储 | Dexie.js (IndexedDB) | v4.x | ✅ 已确定 |
| 动画 | Framer Motion | v11.x | ✅ 已确定 |
| 音频 | Howler.js | v2.x | ✅ 已确定 |
| PWA | Vite PWA Plugin | latest | ✅ 已确定 |
| 测试 | Vitest + RTL | latest | ✅ 已确定 |

**No [NEEDS CLARIFICATION] markers remaining.**

## Phase 1: Design Artifacts

- ✅ [data-model.md](data-model.md) - 数据模型定义 (Dexie.js + TypeScript)
- ✅ [contracts/internal.md](contracts/internal.md) - 内部模块接口契约
- ✅ [quickstart.md](quickstart.md) - 快速开始指南

## Next Steps

Phase 2 任务生成由 `/speckit.tasks` 命令执行。

运行以下命令生成可执行任务列表：
```bash
/speckit.tasks
```
