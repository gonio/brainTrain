import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Theme } from '../types';

interface SettingsState {
  theme: Theme;
  soundEnabled: boolean;
  ttsEnabled: boolean;
  dailyGoalMinutes: number;
  setTheme: (theme: Theme) => void;
  toggleSound: () => void;
  toggleTTS: () => void;
  setDailyGoalMinutes: (minutes: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'auto',
      soundEnabled: true,
      ttsEnabled: true,
      dailyGoalMinutes: 20,

      setTheme: (theme) => set({ theme }),

      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),

      toggleTTS: () => set((state) => ({ ttsEnabled: !state.ttsEnabled })),

      setDailyGoalMinutes: (minutes) => set({ dailyGoalMinutes: minutes }),
    }),
    {
      name: 'brain-train-settings'
    }
  )
);
