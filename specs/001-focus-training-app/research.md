# Research: 专注力训练Web应用技术决策

**Feature**: 专注力训练Web应用
**Date**: 2026-03-28
**Purpose**: 解决技术选型中的不确定性

---

## Decision 1: 前端框架选择

**Decision**: 使用 **React 19 + TypeScript 5.x**

**Rationale**:
- React 19 是最新版本，支持 Server Components、Actions 等新特性
- TypeScript 提供类型安全，减少运行时错误，提升开发体验
- 强大的生态系统和社区支持
- Vite 构建工具提供极速的开发体验（HMR < 50ms）
- 组件化架构适合 7 个独立游戏模块的封装

**Alternatives considered**:
- Vanilla JS: 无类型安全，大型项目维护困难
- Vue 3: 优秀但 React 生态更丰富
- Svelte: 编译时优化好但团队熟悉度较低

---

## Decision 2: UI 组件与样式

**Decision**: 使用 **Tailwind CSS + shadcn/ui**

**Rationale**:
- Tailwind CSS 提供原子化 CSS，开发效率高
- shadcn/ui 提供高质量、可定制的 React 组件
- 无障碍支持（a11y）内置
- 与 TypeScript 完美集成
- 支持主题定制，配合 Stitch MCP 生成的设计系统

**Alternatives considered**:
- Material-UI: 风格过于固定，定制复杂
- Chakra UI: 不错但需要更多依赖
- 纯 Tailwind: 缺少现成组件，开发效率较低

---

## Decision 3: 状态管理

**Decision**: 使用 **Zustand**

**Rationale**:
- 极简 API，学习曲线低
- 完美 TypeScript 支持
- 无需 Provider 包装，代码简洁
- 支持持久化中间件（配合 IndexedDB）
- 比 Redux 轻量，比 Context 性能更好

**Alternatives considered**:
- Redux Toolkit: 功能强大但过于复杂
- Jotai: 原子化状态管理，适合特定场景
- React Context: 性能问题，不适合高频更新

---

## Decision 4: 本地存储方案

**Decision**: 使用 **Dexie.js (IndexedDB 封装)**

**Rationale**:
- IndexedDB 容量大（~50MB+），支持结构化数据
- Dexie.js 提供 Promise API 和 TypeScript 支持
- 支持索引、查询、事务
- 异步 API 不阻塞主线程
- PWA 离线支持的最佳选择

**Schema**:
```typescript
// Dexie 数据库定义
class BrainTrainDB extends Dexie {
  userProfile!: Table<UserProfile>;
  trainingRecords!: Table<TrainingRecord>;
  dailyGoals!: Table<DailyGoal>;

  constructor() {
    super('BrainTrainDB');
    this.version(1).stores({
      userProfile: 'id',
      trainingRecords: 'id, mode, startedAt, [mode+startedAt]',
      dailyGoals: 'date'
    });
  }
}
```

**Alternatives considered**:
- localStorage: 容量小(5MB)，同步 API 阻塞主线程
- idb-keyval: 极简但功能不足
- localForage: 维护较慢，类型支持不佳

---

## Decision 5: 动画方案

**Decision**: 使用 **Framer Motion**

**Rationale**:
- React 生态最流行的动画库
- 声明式 API，与 React 组件无缝集成
- 手势支持（拖拽、滑动）
- 性能优化（自动使用 GPU 加速）
- 支持布局动画和共享元素过渡

**Usage**:
- 页面切换过渡
- 游戏元素动画（卡片翻转、得分弹出）
- 手势交互（滑动切换、拖拽排序）
- 适度动画保持专注度

**Alternatives considered**:
- GSAP: 功能强大但学习曲线陡峭
- React Spring: 物理动画优秀但 API 较复杂
- CSS Animations: 功能有限，难以控制

---

## Decision 6: 音频处理

**Decision**: 使用 **Howler.js**

**Rationale**:
- 跨浏览器音频兼容性最好
- 自动处理音频格式回退
- 支持 Web Audio API 高级功能
- 轻量且成熟稳定

**Implementation**:
- 数字播报音效
- 正确/错误反馈音
- 背景音乐（白噪音）
- 音量控制和静音切换

**Alternatives considered**:
- Web Audio API: 原生但兼容性复杂
- Tone.js: 适合音乐合成，过于复杂

---

## Decision 7: PWA 支持

**Decision**: 使用 **Vite PWA Plugin + Workbox**

**Rationale**:
- Vite PWA 插件自动生成 Service Worker
- Workbox 提供可靠的缓存策略
- 支持离线访问所有训练模式
- 可安装到主屏幕（iOS/Android）

**Features**:
- 离线缓存所有静态资源
- IndexedDB 数据离线可用
- 自动更新检测
- App Shell 架构

---

## Decision 8: 项目结构

**Decision**: 使用 **Vite + 模块化 SPA 结构**

**Structure**:
```
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
│   │   └── game/           # 游戏通用组件
│   ├── pages/              # 页面组件
│   │   ├── Home.tsx        # 首页/游戏选择
│   │   ├── Stats.tsx       # 统计页面
│   │   ├── Settings.tsx    # 设置页面
│   │   └── games/          # 7个游戏页面
│   │       ├── Schulte.tsx
│   │       ├── Stroop.tsx
│   │       ├── Sequence.tsx
│   │       ├── Auditory.tsx
│   │       ├── Mirror.tsx
│   │       ├── Classify.tsx
│   │       └── Story.tsx
│   ├── hooks/              # 自定义 Hooks
│   │   ├── useTimer.ts     # 计时器
│   │   ├── useAudio.ts     # 音频控制
│   │   └── useStats.ts     # 统计计算
│   ├── stores/             # Zustand 状态
│   │   ├── userStore.ts
│   │   ├── gameStore.ts
│   │   └── settingsStore.ts
│   ├── db/                 # Dexie.js 数据库
│   │   └── index.ts
│   ├── types/              # TypeScript 类型
│   │   └── index.ts
│   ├── lib/                # 工具函数
│   │   └── utils.ts
│   └── styles/             # 全局样式
│       └── globals.css
├── tests/                  # 测试文件
│   ├── unit/
│   └── e2e/
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
└── package.json
```

---

## Decision 9: 测试方案

**Decision**: 使用 **Vitest + React Testing Library**

**Rationale**:
- Vitest 与 Vite 无缝集成，速度极快
- 兼容 Jest API，生态成熟
- React Testing Library 是 React 测试标准
- 支持 MSW (Mock Service Worker) 模拟 API

**Testing Strategy**:
- 单元测试：游戏逻辑、工具函数
- 组件测试：UI 组件交互
- E2E 测试：关键用户流程（Playwright）

---

## Decision 10: UI 设计实现

**Decision**: 使用 **Stitch MCP 生成设计系统 + Tailwind 配置**

**Rationale**:
- 规格要求使用 Stitch MCP 进行UI设计
- 将生成的设计系统转换为 Tailwind 配置
- 通过 CSS 变量实现主题定制
- 确保视觉风格统一且专业

**Implementation Plan**:
1. 使用 Stitch MCP 创建项目并生成主界面设计
2. 提取设计令牌（颜色、字体、间距、圆角）
3. 配置 Tailwind CSS 主题扩展
4. 使用 shadcn/ui 组件库构建界面

---

## Summary

| 技术领域 | 选择方案 | 版本 |
|---------|---------|------|
| 框架 | React + TypeScript | v19 + v5.x |
| 构建工具 | Vite | v6.x |
| UI 样式 | Tailwind CSS | v4.x |
| 组件库 | shadcn/ui | latest |
| 状态管理 | Zustand | v5.x |
| 存储 | Dexie.js (IndexedDB) | v4.x |
| 动画 | Framer Motion | v11.x |
| 音频 | Howler.js | v2.x |
| PWA | Vite PWA Plugin | latest |
| 测试 | Vitest + RTL | latest |
| UI 设计 | Stitch MCP | - |

**No [NEEDS CLARIFICATION] markers remaining.**
