import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Theme } from '../types';

interface SettingsState {
  theme: Theme;
  soundEnabled: boolean;
  ttsEnabled: boolean;
  dailyGoalSessions: number;
  ruleDismissed: Record<string, boolean>;
  setTheme: (theme: Theme) => void;
  toggleSound: () => void;
  toggleTTS: () => void;
  setDailyGoalSessions: (sessions: number) => void;
  dismissRule: (mode: string) => void;
  isRuleDismissed: (mode: string) => boolean;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'auto',
      soundEnabled: true,
      ttsEnabled: true,
      dailyGoalSessions: 5,
      ruleDismissed: {},

      setTheme: (theme) => set({ theme }),

      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),

      toggleTTS: () => set((state) => ({ ttsEnabled: !state.ttsEnabled })),

      setDailyGoalSessions: (sessions) => set({ dailyGoalSessions: sessions }),

      dismissRule: (mode) =>
        set((state) => ({
          ruleDismissed: { ...state.ruleDismissed, [mode]: true },
        })),

      isRuleDismissed: (mode) => get().ruleDismissed[mode] === true,
    }),
    {
      name: 'brain-train-settings',
      // 兼容旧版本：dailyGoalMinutes → dailyGoalSessions
      migrate: (persistedState: unknown) => {
        const persisted = persistedState as Record<string, unknown>;
        if ('dailyGoalMinutes' in persisted && !('dailyGoalSessions' in persisted)) {
          persisted['dailyGoalSessions'] = 5;
          delete persisted['dailyGoalMinutes'];
        }
        return persisted;
      },
    }
  )
);
