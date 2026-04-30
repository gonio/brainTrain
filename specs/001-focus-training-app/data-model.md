# Data Model: 专注力训练Web应用

**Feature**: 专注力训练Web应用
**Date**: 2026-03-28
**Storage**: IndexedDB (via Dexie.js)
**Schema Version**: 1

---

## Database Schema (Dexie.js)

```typescript
// db/index.ts
import Dexie, { Table } from 'dexie';

export class BrainTrainDB extends Dexie {
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

export const db = new BrainTrainDB();
```

---

## Entities

### UserProfile

用户档案，存储用户基本信息和累计统计数据。

```typescript
interface UserProfile {
  id: string;                    // 用户唯一标识 (固定 'default'，单用户模式)
  createdAt: string;             // ISO 8601 创建时间
  updatedAt: string;             // ISO 8601 更新时间
  displayName: string;           // 显示名称（可选，默认"用户"）
  totalTrainingTime: number;     // 累计训练时长（分钟）
  totalSessions: number;         // 累计训练次数
  currentStreak: number;         // 当前连续训练天数
  longestStreak: number;         // 最长连续训练天数
  lastTrainingDate: string;      // 上次训练日期 (YYYY-MM-DD)
  preferences: UserPreferences;
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';    // 主题设置，默认auto跟随系统
  soundEnabled: boolean;               // 音效开关
  ttsEnabled: boolean;                 // 语音播报开关
  dailyGoalMinutes: number;            // 每日目标训练时长（默认 20）
}

// 默认值
const defaultUserProfile: UserProfile = {
  id: 'default',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  displayName: '用户',
  totalTrainingTime: 0,
  totalSessions: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastTrainingDate: '',
  preferences: {
    theme: 'auto',
    soundEnabled: true,
    ttsEnabled: true,
    dailyGoalMinutes: 20
  }
};
```

---

### TrainingRecord

单次训练记录，每次完成训练后创建。

```typescript
interface TrainingRecord {
  id: string;                    // 记录唯一标识 (crypto.randomUUID())
  mode: TrainingMode;            // 训练模式
  startedAt: string;             // ISO 8601 开始时间
  endedAt: string;               // ISO 8601 结束时间
  duration: number;              // 实际训练时长（秒）
  score: number;                 // 得分（0-100）
  accuracy: number;              // 准确率（0-100）
  details: TrainingDetails;      // 各模式详细数据
}

type TrainingMode =
  | 'schulte'      // 舒尔特表 - 固定5x5降序
  | 'stroop'       // 字色干扰 - 固定1.5秒限制, 20题
  | 'sequence'     // 序列记忆 - 固定10个物品
  | 'auditory'     // 听觉注意 - 固定7位数字
  | 'mirror'       // 镜像协调 - 固定三角形
  | 'classify'     // 分类逻辑 - 固定3-5题切换规则
  | 'story';       // 情景联想 - 固定7个物品, 10秒记忆

// 各模式特有的详细数据
type TrainingDetails =
  | SchulteDetails
  | StroopDetails
  | SequenceDetails
  | AuditoryDetails
  | MirrorDetails
  | ClassifyDetails
  | StoryDetails;

// 舒尔特表详细数据（固定困难模式）
interface SchulteDetails {
  gridSize: 5;                   // 固定5x5网格
  order: 'desc';                 // 固定降序(25→1)
  completionTime: number;        // 完成用时（秒）
  errorCount: number;            // 错误次数
  clickSequence: number[];       // 点击顺序记录
}

// 字色干扰详细数据（固定困难模式）
interface StroopDetails {
  questionCount: 20;             // 固定20道题目
  timeLimit: 1.5;                // 固定1.5秒限制
  correctCount: number;          // 正确数量
  avgReactionTime: number;       // 平均反应时间（毫秒）
  questions: StroopQuestion[];   // 每题详情
}

interface StroopQuestion {
  word: string;                  // 显示的文字
  wordColor: string;             // 文字颜色
  userAnswer: string;            // 用户答案
  isCorrect: boolean;            // 是否正确
  reactionTime: number;          // 反应时间（毫秒）
}

// 序列记忆详细数据（固定困难模式）
interface SequenceDetails {
  sequenceLength: 10;            // 固定10个物品
  items: string[];               // 物品列表
  userSequence: string[];        // 用户回答序列
  positionAccuracy: number;      // 位置准确率
  itemAccuracy: number;          // 物品准确率
}

// 听觉注意详细数据（固定困难模式）
interface AuditoryDetails {
  digitCount: 7;                 // 固定7位数字
  withNoise: boolean;            // 是否有背景干扰（可选）
  digits: number[];              // 数字序列
  userDigits: number[];          // 用户回答
  correctCount: number;          // 正确数字数
}

// 镜像协调详细数据（固定困难模式）
interface MirrorDetails {
  targetShape: 'triangle';       // 固定三角形
  timeLimit: 30;                 // 固定30秒时间限制
  symmetryScore: number;         // 对称度得分（0-100）
  completenessScore: number;     // 完整性得分（0-100）
  leftPath: PathData;            // 左画布路径
  rightPath: PathData;           // 右画布路径
}

interface PathData {
  points: { x: number; y: number; timestamp: number }[];
}

// 分类逻辑详细数据（固定困难模式）
interface ClassifyDetails {
  ruleType: 'color' | 'shape' | 'size';  // 颜色/形状/大小
  questionCount: 15;             // 固定15个物品
  ruleSwitchInterval: 3 | 4 | 5; // 每3-5题切换规则
  correctCount: number;          // 正确数量
  avgReactionTime: number;       // 平均反应时间
  ruleSwitches: number;          // 规则切换次数
  adaptationBonus: number;       // 规则适应奖励分
}

// 情景联想详细数据（固定困难模式）
interface StoryDetails {
  itemCount: 7;                  // 固定7个物品
  memorizeTime: 10;              // 固定10秒记忆时间
  items: string[];               // 物品列表
  userStory: string;             // 用户编写的故事
  storyCompleteness: number;     // 故事完整度（0-100）
  recallAccuracy: number;        // 回忆准确率
}
```

---

### DailyGoal

每日训练目标记录。

```typescript
interface DailyGoal {
  date: string;                  // 日期 (YYYY-MM-DD)
  targetMinutes: number;         // 目标时长（分钟）
  actualMinutes: number;         // 实际时长（分钟）
  completed: boolean;            // 是否完成目标
  sessions: string[];            // 训练记录ID列表
}
```

---

## Statistics (Computed)

统计数据通过查询计算，不单独存储。

```typescript
interface Statistics {
  // 总体统计
  overall: {
    totalSessions: number;
    totalTime: number;           // 分钟
    avgScore: number;            // 平均分
    avgAccuracy: number;         // 平均准确率
  };

  // 各模式统计
  byMode: Record<TrainingMode, ModeStatistics>;

  // 时间趋势（最近30天）
  trend: DailyStatistics[];
}

interface ModeStatistics {
  sessions: number;
  avgScore: number;
  avgAccuracy: number;
  bestScore: number;
  totalTime: number;
}

interface DailyStatistics {
  date: string;
  sessions: number;
  totalTime: number;
  avgScore: number;
}
```

---

## Data Access Layer (DAL)

```typescript
// db/queries.ts

export async function getUserProfile(): Promise<UserProfile> {
  const profile = await db.userProfile.get('default');
  return profile || defaultUserProfile;
}

export async function updateUserProfile(
  updates: Partial<UserProfile>
): Promise<void> {
  await db.userProfile.put({
    ...defaultUserProfile,
    ...updates,
    id: 'default',
    updatedAt: new Date().toISOString()
  });
}

export async function saveTrainingRecord(
  record: TrainingRecord
): Promise<void> {
  await db.trainingRecords.add(record);
}

export async function getTrainingRecords(
  options?: {
    mode?: TrainingMode;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }
): Promise<TrainingRecord[]> {
  let query = db.trainingRecords.toCollection();

  if (options?.mode) {
    query = db.trainingRecords.where('mode').equals(options.mode);
  }

  if (options?.startDate && options?.endDate) {
    query = db.trainingRecords
      .where('startedAt')
      .between(options.startDate, options.endDate);
  }

  return query.reverse().limit(options?.limit || 100).toArray();
}

export async function getDailyGoal(date: string): Promise<DailyGoal | undefined> {
  return db.dailyGoals.get(date);
}

export async function updateDailyGoal(goal: DailyGoal): Promise<void> {
  await db.dailyGoals.put(goal);
}

export async function computeStatistics(): Promise<Statistics> {
  const records = await db.trainingRecords.toArray();
  // 计算逻辑...
}
```

---

## Validation Rules

1. **TrainingRecord.score**: 0-100 之间
2. **TrainingRecord.duration**: 必须 > 0
3. **TrainingRecord.startedAt**: 必须早于 endedAt
4. **UserProfile.totalTrainingTime**: 累计所有记录时长
5. **DailyGoal.actualMinutes**: 当天所有记录时长之和
6. **DailyGoal.targetMinutes**: 默认 20，范围 5-120

---

## State Transitions

### Training Session Lifecycle

```
[Idle] -> [Start] -> [InProgress] -> [Complete/Abandon] -> [RecordSaved]
```

- **Idle**: 游戏选择界面
- **Start**: 用户点击开始，初始化游戏状态
- **InProgress**: 训练进行中，计时器运行
- **Complete**: 用户完成训练，显示成绩
- **Abandon**: 用户中途退出，可选择保存/放弃
- **RecordSaved**: 记录保存到 IndexedDB，更新统计数据

### Zustand Store 状态

```typescript
interface GameState {
  status: 'idle' | 'playing' | 'paused' | 'completed';
  currentMode: TrainingMode | null;
  startTime: number | null;
  elapsedTime: number;
  score: number;
  // ... 游戏特定状态
}
```
