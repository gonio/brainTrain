import { create } from 'zustand';
import type { UserProfile, UserPreferences } from '../types';
import { getUserProfile, updateUserProfile } from '../db/queries';

interface UserState {
  profile: UserProfile | null;
  isLoading: boolean;
  loadProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  profile: null,
  isLoading: true,

  loadProfile: async () => {
    set({ isLoading: true });
    try {
      const profile = await getUserProfile();
      set({ profile, isLoading: false });
    } catch (error) {
      console.error('Failed to load profile:', error);
      set({ isLoading: false });
    }
  },

  updateProfile: async (updates) => {
    try {
      await updateUserProfile(updates);
      const profile = await getUserProfile();
      set({ profile });
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  },

  updatePreferences: async (prefs) => {
    const current = get().profile;
    if (!current) return;

    try {
      await updateUserProfile({
        preferences: { ...current.preferences, ...prefs }
      });
      const profile = await getUserProfile();
      set({ profile });
    } catch (error) {
      console.error('Failed to update preferences:', error);
    }
  }
}));
