import { create } from 'zustand';
import type { TrainingMode, GameStatus, GameResult, TrainingDetails } from '../types';
import { saveTrainingRecord, updateDailyGoal, getDailyGoal } from '../db/queries';
import { generateId, getToday } from '../lib/utils';

interface GameState {
  status: GameStatus;
  currentMode: TrainingMode | null;
  startTime: number | null;
  endTime: number | null;
  score: number;
  accuracy: number;
  details: TrainingDetails | null;

  // Actions
  startGame: (mode: TrainingMode) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: (result: Omit<GameResult, 'duration'>) => Promise<void>;
  abandonGame: () => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  status: 'idle',
  currentMode: null,
  startTime: null,
  endTime: null,
  score: 0,
  accuracy: 0,
  details: null,

  startGame: (mode) => {
    set({
      status: 'playing',
      currentMode: mode,
      startTime: Date.now(),
      endTime: null,
      score: 0,
      accuracy: 0,
      details: null
    });
  },

  pauseGame: () => {
    if (get().status === 'playing') {
      set({ status: 'paused' });
    }
  },

  resumeGame: () => {
    if (get().status === 'paused') {
      set({ status: 'playing' });
    }
  },

  endGame: async (result) => {
    const state = get();
    if (!state.currentMode || !state.startTime) return;

    const endTime = Date.now();
    const duration = Math.floor((endTime - state.startTime) / 1000);

    // 所有训练固定困难模式
    const record = {
      id: generateId(),
      mode: state.currentMode,
      startedAt: new Date(state.startTime).toISOString(),
      endedAt: new Date(endTime).toISOString(),
      duration,
      score: result.score,
      accuracy: result.accuracy,
      details: result.details
    };

    try {
      // Save training record
      await saveTrainingRecord(record);

      // Update daily goal
      const today = getToday();
      const goal = await getDailyGoal(today);

      const completedSessions = (goal?.completedSessions || 0) + 1;
      const targetSessions = goal?.targetSessions || 5;

      await updateDailyGoal({
        date: today,
        targetSessions,
        completedSessions,
        completed: completedSessions >= targetSessions,
      });

      set({
        status: 'completed',
        endTime,
        score: result.score,
        accuracy: result.accuracy,
        details: result.details
      });
    } catch (error) {
      console.error('Failed to save game result:', error);
    }
  },

  abandonGame: () => {
    set({
      status: 'idle',
      currentMode: null,
      startTime: null,
      endTime: null,
      score: 0,
      accuracy: 0,
      details: null
    });
  },

  resetGame: () => {
    set({
      status: 'idle',
      currentMode: null,
      startTime: null,
      endTime: null,
      score: 0,
      accuracy: 0,
      details: null
    });
  }
}));
