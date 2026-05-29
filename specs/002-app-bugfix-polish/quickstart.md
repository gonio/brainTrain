# Quickstart: 应用精简与统一化改造

## 前置条件

- Node.js 20+
- pnpm 9+
- 现有项目可正常 `pnpm run dev` 和 `pnpm run build`

## 实施顺序

### 阶段 1: 删除 3 个游戏

1. 删除 6 个文件: `pages/games/{Auditory,Classify,Story}.tsx`, `components/game/{AuditoryGame,ClassifyGame,StoryGame}.tsx`
2. 修改 `types/index.ts`: 从 `TrainingMode` 联合类型中移除 `'auditory' | 'classify' | 'story'`，删除 `AuditoryDetails`, `ClassifyDetails`, `StoryDetails` 接口，从 `TrainingDetails` 联合类型中移除它们
3. 修改 `App.tsx`: 从 `games` 数组中移除 3 个游戏对象，从路由 `children` 中移除 3 个路由，移除 3 个 import
4. 修改 `components/game/index.ts`: 移除 3 个导出
5. 修改 `components/game/GameCard.tsx`: 从 `modeIcons` 和 `modeColors` 中移除 3 个条目
6. 修改 `components/layout/AppLayout.tsx`: 从 `GAME_PATHS` 中移除 3 个路径
7. 修改 `lib/gameplayInstructions.ts`: 移除 3 个指令对象和映射条目
8. 修改 `lib/stats.ts`: 从 modes 数组中移除 3 个值
9. 修改 `hooks/useStats.ts`: 从 modes 数组中移除 3 个值
10. 修改 `db/queries.ts`: 从 modes 数组中移除 3 个值
11. 修改 `pages/Stats.tsx`: 从 `modeNames` 和 `modeIcons` 中移除 3 个条目
12. 运行 `npx tsc --noEmit` 验证无编译错误
13. 运行 `pnpm run build` 验证构建成功

### 阶段 2: 统一评分制 (满分 100)

1. 修改 `db/index.ts`: 升级 Dexie 版本 v1 → v2，在 upgrade 中清除 trainingRecords 和 dailyGoals
2. 修改 `pages/games/Schulte.tsx`: 替换评分算法为 0-100 加权模型
3. 修改 `pages/games/Stroop.tsx`: 替换评分算法为 0-100 加权模型
4. 修改 `pages/games/Sequence.tsx`: 替换评分算法为 0-100 加权模型
5. 验证：完成任意游戏后检查分数在 0-100 范围

### 阶段 3: 游戏规则弹窗

1. 修改 `stores/settingsStore.ts`: 新增 `ruleDismissed` 字段和 `dismissRule(mode)` action，将 `dailyGoalMinutes` 改为 `dailyGoalSessions`
2. 新增 `components/game/GameStartScreen.tsx`: 通用开始页面组件
3. 修改 `pages/games/Schulte.tsx`: 在 idle 状态渲染 GameStartScreen
4. 修改 `pages/games/Stroop.tsx`: 在 idle 状态渲染 GameStartScreen
5. 修改 `pages/games/Sequence.tsx`: 在 idle 状态渲染 GameStartScreen
6. 验证：首次进入游戏弹出规则，勾选"不再提示"后关闭，再次进入不弹出，"展示规则"按钮始终可用

### 阶段 4: 统计从时间改为次数

1. 修改 `types/index.ts`: 从 `OverallStatistics` 和 `ModeStatistics` 中移除 `totalTime` 字段
2. 修改 `lib/stats.ts`: 从 `calculateOverallStats` 和 `calculateModeStats` 中移除时间计算
3. 修改 `pages/Stats.tsx`: 所有时间维度显示改为次数
4. 修改 `pages/Settings.tsx`: 目标选项从分钟改为次数
5. 修改 `components/layout/BottomNav.tsx` (TopBar): 进度条从"N/M分钟"改为"N/M次"
6. 修改 `App.tsx` (Home): 周数据展示适配
7. 修改 `db/queries.ts`: dailyGoal 相关查询适配次数制
8. 验证：所有页面统计维度为次数，不出现"分钟"

## 验证检查清单

- [ ] `npx tsc --noEmit` 零错误
- [ ] `pnpm run build` 成功
- [ ] 首页只显示 3 个游戏卡片
- [ ] 3 个游戏均可正常完成，分数 0-100
- [ ] 首次进入游戏弹出规则，"不再提示"生效
- [ ] "展示规则"按钮始终可用
- [ ] 统计页所有指标为次数维度
- [ ] 每日目标为"N次"
- [ ] 无 auditory/classify/story 任何残留引用
