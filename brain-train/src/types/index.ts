// Training modes
export type TrainingMode =
  | 'schulte'   // 舒尔特表 - 固定5x5降序
  | 'stroop'    // 字色干扰 - 固定1.5秒限制, 20题
  | 'sequence'  // 序列记忆 - 固定10个物品
  | 'auditory'  // 听觉注意 - 固定7位数字
  | 'classify'  // 分类逻辑 - 固定15题, 3-5题切换规则
  | 'story';    // 情景联想 - 固定7个物品, 10秒记忆

export type Theme = 'light' | 'dark' | 'auto';

// User preferences
export interface UserPreferences {
  theme: Theme;
  soundEnabled: boolean;
  ttsEnabled: boolean;
  dailyGoalMinutes: number;
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
  gridSize: 3 | 4 | 5;
  order: 'asc' | 'desc';
  completionTime: number;
  errorCount: number;
  clickSequence: number[];
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

export interface AuditoryDetails {
  digitCount: number;
  withNoise: boolean;
  digits: number[];
  userDigits: number[];
  correctCount: number;
}

export interface ClassifyDetails {
  ruleType: 'color' | 'shape' | 'size' | 'mixed';
  questionCount: number;
  correctCount: number;
  avgReactionTime: number;
  ruleSwitches: number;
}

export interface StoryDetails {
  items: string[];
  userStory: string;
  storyCompleteness: number;
  recallAccuracy: number;
}

export type TrainingDetails =
  | SchulteDetails
  | StroopDetails
  | SequenceDetails
  | AuditoryDetails
  | ClassifyDetails
  | StoryDetails;

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
  targetMinutes: number;
  actualMinutes: number;
  completed: boolean;
  sessions: string[];
}

// Statistics
export interface ModeStatistics {
  sessions: number;
  avgScore: number;
  avgAccuracy: number;
  bestScore: number;
  totalTime: number;
}

export interface DailyStatistics {
  date: string;
  sessions: number;
  totalTime: number;
  avgScore: number;
}

export interface Statistics {
  overall: {
    totalSessions: number;
    totalTime: number;
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
