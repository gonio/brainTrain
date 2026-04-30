# Interface Contracts

**Project**: 专注力训练Web应用
**Date**: 2026-03-28
**Tech Stack**: React 19 + TypeScript + Vite

---

## Overview

This is a React-based PWA with no external API dependencies. All data is stored locally using IndexedDB (via Dexie.js).

## External Dependencies

| Service | Usage | Fallback |
|---------|-------|----------|
| Web Speech API | TTS for auditory training | Pre-recorded audio files |
| IndexedDB | Local data storage | In-memory storage (limited) |
| Service Worker | PWA offline support | Online-only mode |

## Internal Module Contracts

### Database Module (src/db/index.ts)

```typescript
// Dexie.js database instance
export const db: BrainTrainDB;

// Queries
export function getUserProfile(): Promise<UserProfile>;
export function updateUserProfile(updates: Partial<UserProfile>): Promise<void>;
export function saveTrainingRecord(record: TrainingRecord): Promise<void>;
export function getTrainingRecords(options?: FilterOptions): Promise<TrainingRecord[]>;
export function getDailyGoal(date: string): Promise<DailyGoal | undefined>;
export function updateDailyGoal(goal: DailyGoal): Promise<void>;
export function computeStatistics(): Promise<Statistics>;
```

### Store Contracts (Zustand)

```typescript
// src/stores/userStore.ts
interface UserStore {
  profile: UserProfile;
  isLoading: boolean;
  loadProfile(): Promise<void>;
  updateProfile(updates: Partial<UserProfile>): Promise<void>;
  updatePreferences(prefs: Partial<UserPreferences>): Promise<void>;
}

// src/stores/gameStore.ts
interface GameStore {
  status: 'idle' | 'playing' | 'paused' | 'completed';
  currentMode: TrainingMode | null;
  currentRecord: Partial<TrainingRecord> | null;
  showInstructions: boolean;       // 是否显示玩法说明
  startGame(mode: TrainingMode): void;  // 无难度参数
  showGameplayInstructions(): void;     // 显示玩法说明
  hideGameplayInstructions(): void;     // 隐藏玩法说明
  pauseGame(): void;
  resumeGame(): void;
  endGame(result: GameResult): Promise<void>;
  abandonGame(): void;
}

// src/stores/settingsStore.ts
interface SettingsStore {
  theme: 'light' | 'dark' | 'auto';  // 默认auto跟随系统
  soundEnabled: boolean;
  ttsEnabled: boolean;
  setTheme(theme: 'light' | 'dark' | 'auto'): void;
  toggleSound(): void;
  toggleTTS(): void;
}
```

### Hook Contracts

```typescript
// src/hooks/useTimer.ts
function useTimer(): {
  elapsed: number;
  isRunning: boolean;
  start(): void;
  pause(): void;
  reset(): void;
};

// src/hooks/useAudio.ts
function useAudio(): {
  isEnabled: boolean;
  playEffect(name: 'correct' | 'wrong' | 'complete'): void;
  speak(text: string): void;
  toggle(): void;
};

// src/hooks/useStats.ts
function useStats(mode?: TrainingMode): {
  stats: Statistics | null;
  isLoading: boolean;
  refresh(): Promise<void>;
};
```

### Game Page Interface

Each game page must implement:

```typescript
interface GamePageProps {
  // 无难度参数 - 所有训练固定困难模式
  onComplete: (result: GameResult) => void;
  onAbandon: () => void;
}

// 游戏玩法说明配置
interface GameplayInstructionsConfig {
  mode: TrainingMode;
  title: string;
  description: string;      // 训练目标描述
  howToPlay: string[];      // 操作步骤（5-6步）
  scoringRules: string[];   // 评分规则说明
  hardModeNote: string;     // 困难模式说明
}

interface GameResult {
  score: number;
  accuracy: number;
  duration: number;
  details: TrainingDetails;
}
```

## Component Contracts

### Layout Components

```typescript
// src/components/layout/AppLayout.tsx
interface AppLayoutProps {
  children: React.ReactNode;
  showNav?: boolean;
  title?: string;
}

// src/components/layout/GameLayout.tsx
interface GameLayoutProps {
  children: React.ReactNode;
  title: string;
  onExit: () => void;
  timer?: React.ReactNode;
}
```

### Game Components

```typescript
// src/components/game/ScoreBoard.tsx
interface ScoreBoardProps {
  score: number;
  accuracy: number;
  duration: number;
}

// src/components/game/GameplayInstructions.tsx
interface GameplayInstructionsProps {
  config: GameplayInstructionsConfig;
  isOpen: boolean;
  onConfirm: () => void;    // 用户确认理解后开始游戏
}
```

## Event Contracts

### Game Events (Custom Events)

```typescript
// Game started
// 注意：所有训练固定困难模式，无难度参数
document.dispatchEvent(new CustomEvent('game:started', {
  detail: { mode: TrainingMode }
}));

// Game completed
document.dispatchEvent(new CustomEvent('game:completed', {
  detail: { mode: TrainingMode; result: GameResult }
}));

// Game abandoned
document.dispatchEvent(new CustomEvent('game:abandoned', {
  detail: { mode: TrainingMode; elapsedTime: number }
}));
```

## PWA Manifest

```json
{
  "name": "BrainTrain 专注力训练",
  "short_name": "BrainTrain",
  "description": "科学有效的专注力训练应用",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512" }
  ]
}
```

## No External APIs

This project does not integrate with:
- REST APIs
- GraphQL endpoints
- Third-party authentication
- Cloud databases

All functionality is self-contained within the browser.
