// Training modes
export type TrainingMode =
  | 'schulte'   // 舒尔特表
  | 'stroop'    // 字色干扰
  | 'sequence'  // 序列记忆
  | 'bottle';   // 暗瓶排列

export type Theme = 'light' | 'dark' | 'auto';

// User preferences
export interface UserPreferences {
  theme: Theme;
  soundEnabled: boolean;
  ttsEnabled: boolean;
  dailyGoalSessions: number;
  hasSeenOnboarding?: boolean;
}

// User profile
export interface UserProfile {
  id: string;
  createdAt: string;
  updatedAt: string;
  displayName: string;
  avatar?: string; // base64 或 emoji 头像
  totalTrainingTime: number;
  totalSessions: number;
  currentStreak: number;
  longestStreak: number;
  lastTrainingDate: string;
  preferences: UserPreferences;
}

// Training details for each mode
export interface SchulteDetails {
  mode: 'quest' | 'free';            // 必填，作为 discriminated tag
  level?: number;                    // 闯关模式有
  gridSize: 3 | 4 | 5 | 6;
  order: 'asc' | 'desc' | 'alternate' | 'mixed';
  completionTime: number;
  errorCount: number;
  clickSequence: number[];
  maxCombo: number;
  livesUsed?: number;
  timeLimitPerNumber?: number;
  stars?: 1 | 2 | 3;
}

export interface StroopQuestion {
  word: string;
  wordColor: string;
  userAnswer: string;
  isCorrect: boolean;
  reactionTime: number;
}

export interface StroopDetails {
  questionCount: number;
  correctCount: number;
  avgReactionTime: number;
  questions: StroopQuestion[];
}

export interface SequenceDetails {
  sequenceLength: number;
  items: string[];
  userSequence: string[];
  positionAccuracy: number;
  itemAccuracy: number;
}

export interface BottleDetails {
  difficulty: 'easy' | 'medium' | 'hard';
  bottleCount: number;           // 4 | 6 | 9
  targetSequence: string[];      // 下排颜色 ID 数组（隐藏答案）
  playerSequence: string[];      // 上排颜色 ID 数组（玩家最终排列）
  totalSwaps: number;            // 总交换步数
  optimalSwaps: number;          // 最优步数
  completionTime: number;        // 完成用时（秒）
}

// 训练详情联合类型
export type TrainingDetails = SchulteDetails | StroopDetails | SequenceDetails | BottleDetails;

// Training record
export interface TrainingRecord {
  id: string;
  mode: TrainingMode;
  startedAt: string;
  endedAt: string;
  duration: number;
  score: number;
  accuracy: number;
  details: TrainingDetails;
}

// Daily goal
export interface DailyGoal {
  date: string;
  targetSessions: number;
  completedSessions: number;
  completed: boolean;
}

// Statistics
export interface ModeStatistics {
  sessions: number;
  avgScore: number;
  avgAccuracy: number;
  bestScore: number;
}

export interface DailyStatistics {
  date: string;
  sessions: number;
  avgScore: number;
}

export interface Statistics {
  overall: {
    totalSessions: number;
    avgScore: number;
    avgAccuracy: number;
  };
  byMode: Record<TrainingMode, ModeStatistics>;
  trend: DailyStatistics[];
}

// Game state
export interface GameResult {
  score: number;
  accuracy: number;
  duration: number;
  details: TrainingDetails;
}

export type GameStatus = 'idle' | 'playing' | 'paused' | 'completed';

// 舒尔特闯关 - 关卡配置（写死的常量，不入库）
export interface SchulteQuestLevelConfig {
  level: number;
  gridSize: 3 | 4 | 5 | 6;
  direction: 'asc' | 'desc' | 'alternate' | 'mixed';
  timeLimitPerNumber?: number;
  lives: 1 | 2 | 3;
  comboTarget: number;
}

// 舒尔特闯关 - 玩家进度（入库，单条记录）
export interface SchulteQuestProgress {
  id: 'singleton';                  // 固定主键，使用 put 而非 add
  clearedLevel: number;             // 已通关的最高关（0-10）
  totalStars: number;               // 累计星数（0-30）
  inProgressLevel?: number;         // 暂停退出时未完成的关
  levelRecords: Record<number, {
    stars: 1 | 2 | 3;
    bestScore: number;
    bestCombo: number;
    bestTime: number;
  }>;
}
