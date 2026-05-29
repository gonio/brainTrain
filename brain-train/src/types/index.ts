// Training modes
export type TrainingMode =
  | 'schulte'   // 舒尔特表
  | 'stroop'    // 字色干扰
  | 'sequence'; // 序列记忆

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

// 训练详情联合类型
export type TrainingDetails = SchulteDetails | StroopDetails | SequenceDetails;

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
