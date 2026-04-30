# Data Model: 应用问题修复与优化

本文档定义了本次修复涉及的数据模型变更和补充。

## 实体定义

### UserPreference（用户偏好）

存储用户主题设置和其他偏好。

```typescript
interface UserPreference {
  id: string;                    // 主键，固定为 'default'
  themeMode: 'auto' | 'light' | 'dark';  // 主题模式：自动/浅色/深色
  updatedAt: Date;               // 更新时间
}
```

**变更说明**:
- 新增 `themeMode` 字段支持三种模式（原为 boolean）
- 默认值为 `'auto'`，表示跟随系统主题

### UserProfile（用户资料）

存储用户显示名称和头像。

```typescript
interface UserProfile {
  id: string;                    // 主键，固定为 'default'
  displayName: string;           // 显示名称
  avatarUrl: string;             // 头像URL（可以是预设头像ID或base64）
  presetAvatarId?: string;       // 预设头像ID（如果使用的是预设头像）
  updatedAt: Date;               // 更新时间
}
```

**变更说明**:
- 新增 `presetAvatarId` 字段支持预设头像选择
- 头像支持两种模式：预设头像（通过ID引用）或自定义上传（base64）

### TrainingRecord（训练记录）

已有实体，本次修复需验证查询逻辑正确性。

```typescript
interface TrainingRecord {
  id: string;                    // 主键，自增
  gameType: GameType;            // 游戏类型
  score: number;                 // 得分
  duration: number;              // 训练时长（秒）
  accuracy?: number;             // 准确率（部分游戏）
  createdAt: Date;               // 创建时间
}

type GameType =
  | 'schulte'      // 舒尔特表
  | 'stroop'       // 字色干扰
  | 'sequence'     // 序列记忆
  | 'auditory'     // 听觉注意
  | 'mirror'       // 镜像协调
  | 'classify'     // 分类逻辑
  | 'story';       // 情景联想
```

### TrainingStats（训练统计）

派生数据，从 TrainingRecord 计算得出。

```typescript
interface TrainingStats {
  totalSessions: number;         // 总训练次数
  consecutiveDays: number;       // 连续训练天数
  averageScore: number;          // 平均得分
  todaySessions: number;         // 今日训练次数
  lastTrainingDate: Date | null; // 最后训练日期
}
```

**计算逻辑**:
- `totalSessions`: COUNT(TrainingRecord)
- `consecutiveDays`: 从今天倒推，计算连续有训练记录的天数
- `averageScore`: AVG(TrainingRecord.score)
- `todaySessions`: COUNT(TrainingRecord WHERE createdAt >= today)

## 数据库 Schema（Dexie.js）

```typescript
class BrainTrainDB extends Dexie {
  userPreferences!: Table<UserPreference>;
  userProfiles!: Table<UserProfile>;
  trainingRecords!: Table<TrainingRecord>;

  constructor() {
    super('BrainTrainDB');
    this.version(2).stores({
      userPreferences: 'id, themeMode, updatedAt',
      userProfiles: 'id, displayName, updatedAt',
      trainingRecords: '++id, gameType, score, createdAt',
    });
  }
}
```

**迁移说明**:
- 版本从 1 升级到 2
- `userPreferences` 表结构变更：`theme` (boolean) → `themeMode` (string)
- 迁移时：原 `theme: true` → `themeMode: 'dark'`，`theme: false` → `themeMode: 'light'`

## 关键查询

### 获取用户统计

```typescript
async function getTrainingStats(): Promise<TrainingStats> {
  const records = await db.trainingRecords.toArray();

  // 按日期分组计算连续天数
  const trainingDates = [...new Set(records.map(r =>
    new Date(r.createdAt).toDateString()
  ))].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  let consecutiveDays = 0;
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  if (trainingDates[0] === today || trainingDates[0] === yesterday) {
    consecutiveDays = 1;
    for (let i = 1; i < trainingDates.length; i++) {
      const curr = new Date(trainingDates[i - 1]);
      const prev = new Date(trainingDates[i]);
      const diffDays = (curr.getTime() - prev.getTime()) / 86400000;
      if (diffDays === 1) {
        consecutiveDays++;
      } else {
        break;
      }
    }
  }

  return {
    totalSessions: records.length,
    consecutiveDays,
    averageScore: records.length > 0
      ? records.reduce((sum, r) => sum + r.score, 0) / records.length
      : 0,
    todaySessions: records.filter(r =>
      new Date(r.createdAt).toDateString() === today
    ).length,
    lastTrainingDate: records.length > 0
      ? new Date(Math.max(...records.map(r => r.createdAt.getTime())))
      : null,
  };
}
```

## 状态管理（Zustand）

### settingsStore

```typescript
interface SettingsState {
  themeMode: 'auto' | 'light' | 'dark';
  effectiveTheme: 'light' | 'dark';  // 实际生效的主题（auto时根据系统计算）

  // Actions
  setThemeMode: (mode: 'auto' | 'light' | 'dark') => Promise<void>;
  initializeTheme: () => Promise<void>;
}
```

### userStore

```typescript
interface UserState {
  displayName: string;
  avatarUrl: string;
  presetAvatarId: string | null;

  // Actions
  updateDisplayName: (name: string) => Promise<void>;
  updateAvatar: (options: { presetId?: string; customUrl?: string }) => Promise<void>;
  initializeUser: () => Promise<void>;
}
```

## 预设头像列表

```typescript
const PRESET_AVATARS = [
  { id: 'avatar1', url: '/avatars/avatar1.svg', label: '默认头像 1' },
  { id: 'avatar2', url: '/avatars/avatar2.svg', label: '默认头像 2' },
  { id: 'avatar3', url: '/avatars/avatar3.svg', label: '默认头像 3' },
  { id: 'avatar4', url: '/avatars/avatar4.svg', label: '默认头像 4' },
  { id: 'avatar5', url: '/avatars/avatar5.svg', label: '默认头像 5' },
  { id: 'avatar6', url: '/avatars/avatar6.svg', label: '默认头像 6' },
];
```
