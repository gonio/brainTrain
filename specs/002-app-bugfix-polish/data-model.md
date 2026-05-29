# Data Model: 应用精简与统一化改造

## 实体变更概览

### 1. TrainingMode (联合类型)

```typescript
// 变更前
type TrainingMode = 'schulte' | 'stroop' | 'sequence' | 'auditory' | 'classify' | 'story';

// 变更后
type TrainingMode = 'schulte' | 'stroop' | 'sequence';
```

**影响范围**: types/index.ts, App.tsx, Stats.tsx, GameCard.tsx, gameplayInstructions.ts, queries.ts, stats.ts, useStats.ts

### 2. TrainingRecord (数据库表)

```typescript
interface TrainingRecord {
  id: string;
  mode: TrainingMode;           // 仅 schulte/stroop/sequence
  score: number;                 // 变更: 0-100 (原 0-1300)
  accuracy: number;              // 不变: 0-100
  duration: number;              // 不变: 秒
  startedAt: string;             // 不变: ISO 8601
  completedAt: string;           // 不变: ISO 8601
  details: TrainingDetails;      // 精简: 仅 3 种 Details
}
```

**数据迁移**: Dexie v1 → v2，清除所有现有记录。

### 3. UserPreferences (settingsStore 字段)

```typescript
interface UserPreferences {
  // 不变
  theme: 'light' | 'dark' | 'auto';
  soundEnabled: boolean;
  ttsEnabled: boolean;

  // 变更
  dailyGoalSessions: number;     // 新增: 每日训练次数目标 (替代 dailyGoalMinutes)

  // 新增
  ruleDismissed: Record<TrainingMode, boolean>;  // 按游戏存储"不再提示"偏好
}
```

**存储位置**: settingsStore → localStorage (key: `brain-train-settings`)

**每日目标选项**: [3, 5, 8, 10, 15] 次

### 4. DailyGoal (数据库表)

```typescript
interface DailyGoal {
  date: string;                  // 主键: YYYY-MM-DD
  completed: number;             // 已完成训练次数
  target: number;                // 目标训练次数 (替代 duration: 已完成秒数)
}
```

**数据迁移**: 随 v2 upgrade 清除所有现有 dailyGoals。

### 5. Statistics (计算值)

```typescript
interface OverallStatistics {
  totalSessions: number;         // 不变: 总训练次数
  avgScore: number;              // 不变: 平均分数 (0-100)
  avgAccuracy: number;           // 不变: 平均准确率
  // 删除: totalTime (总训练时长)
}

interface ModeStatistics {
  sessions: number;              // 不变: 训练次数
  avgScore: number;              // 不变 (0-100)
  avgAccuracy: number;           // 不变
  bestScore: number;             // 不变 (0-100)
  // 删除: totalTime
}
```

### 6. TrainingDetails (联合类型)

```typescript
// 变更前: 6 种 Details
type TrainingDetails = SchulteDetails | StroopDetails | SequenceDetails
  | AuditoryDetails | ClassifyDetails | StoryDetails;

// 变更后: 3 种 Details
type TrainingDetails = SchulteDetails | StroopDetails | SequenceDetails;
```

**保留的 Details 类型**:
- `SchulteDetails`: { gridSize, errors, totalTime }
- `StroopDetails`: { correctCount, totalCount, avgReactionTime }
- `SequenceDetails`: { sequenceLength, positionAccuracy, itemAccuracy }

### 7. Dexie 数据库版本迁移

```typescript
// db/index.ts
const db = new Dexie('BrainTrainDB');

// v1 → v2 迁移
db.version(2).stores({
  userProfile: 'id',
  trainingRecords: 'id, mode, startedAt, [mode+startedAt]',
  dailyGoals: 'date'
}).upgrade(tx => {
  // 清除所有训练记录和每日目标
  tx.table('trainingRecords').clear();
  tx.table('dailyGoals').clear();
});
```

## 状态转换

### 游戏状态 (gameStore)

不变。状态机: idle → playing → paused → playing → completed

### 规则弹窗状态 (新增)

```
首次进入游戏:
  idle + !ruleDismissed[mode] → 自动弹出规则弹窗
  idle + ruleDismissed[mode] → 不弹出

游戏开始页面:
  展示规则按钮 → 手动弹出规则弹窗 (不受 ruleDismissed 影响)
```

## 验证规则

| 字段 | 规则 |
|------|------|
| score | 0 <= score <= 100, 整数 |
| accuracy | 0 <= accuracy <= 100, 整数 |
| dailyGoalSessions | 值 ∈ [3, 5, 8, 10, 15] |
| ruleDismissed[mode] | key ∈ TrainingMode, value: boolean |
| TrainingMode | 仅 'schulte' \| 'stroop' \| 'sequence' |
