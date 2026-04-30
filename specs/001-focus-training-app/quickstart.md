# Quick Start: 专注力训练Web应用

## Prerequisites

- Node.js 20+
- pnpm (推荐) 或 npm/yarn

## Development Setup

### 1. Clone and Install

```bash
cd BrainTrain

# 使用 pnpm
pnpm install

# 或使用 npm
npm install
```

### 2. Development Server

```bash
# 使用 pnpm
pnpm dev

# 或使用 npm
npm run dev
```

应用将在 `http://localhost:5173` 启动

### 3. Build for Production

```bash
# 构建
pnpm build

# 预览生产构建
pnpm preview
```

## Project Structure

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

## Key Technologies

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.x | UI 框架 |
| TypeScript | 5.x | 类型安全 |
| Vite | 6.x | 构建工具 |
| Tailwind CSS | 4.x | 样式 |
| shadcn/ui | latest | UI 组件 |
| Zustand | 5.x | 状态管理 |
| Dexie.js | 4.x | IndexedDB 封装 |
| Framer Motion | 11.x | 动画 |
| Howler.js | 2.x | 音频 |

## Adding a New Game

1. **创建游戏页面**
   ```bash
   touch src/pages/games/NewGame.tsx
   ```

2. **定义游戏类型**
   ```typescript
   // src/types/index.ts
   export interface NewGameDetails {
     // 游戏特定数据 - 所有训练固定困难模式
   }
   ```

3. **添加路由**
   ```typescript
   // src/App.tsx
   import { NewGame } from './pages/games/NewGame';

   <Route path="/games/new-game" element={<NewGame />} />
   ```

4. **添加到首页**
   ```typescript
   // src/pages/Home.tsx
   const games = [
     // ... existing games
     { id: 'new-game', name: '新游戏', icon: '...', description: '...' }
   ];
   ```

## Testing

### 运行测试

```bash
# 单元测试
pnpm test

# 带覆盖率
pnpm test:coverage

# E2E 测试
pnpm test:e2e
```

### 测试规范

- 组件测试放在 `tests/unit/components/`
- Hooks 测试放在 `tests/unit/hooks/`
- 游戏逻辑测试放在 `tests/unit/games/`

## PWA Development

### 添加图标

将图标文件放入 `public/icons/`:
- icon-192x192.png
- icon-512x512.png
- icon-maskable-192x192.png
- icon-maskable-512x512.png

### 本地测试 PWA

```bash
# 构建生产版本
pnpm build

# 预览（支持 Service Worker）
pnpm preview
```

使用 Chrome DevTools > Application > Service Workers 调试。

## Troubleshooting

### IndexedDB 错误

- 检查浏览器是否支持 IndexedDB
- 清除浏览器数据后重试
- 无痕模式可能限制存储

### 音频无法播放

- 确保用户有交互后再播放音频
- 检查浏览器自动播放策略
- 验证音频文件格式支持

### PWA 不生效

- 确认 HTTPS 或 localhost
- 检查 manifest.json 路径
- 验证 Service Worker 注册
