// 多人对战 auth store：管理 token/user 状态，自动建号
import { create } from 'zustand';
import type { VersusUser } from '../types/versus';
import { versusApi } from '../lib/versusApi';

interface AuthState {
  user: VersusUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;

  // 确保已登录：无 token 则自动建号
  ensureAuthenticated: () => Promise<void>;
  // 重置（测试用 + 登出）
  reset: () => void;
  // 判断是否已登录
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  loading: false,
  error: null,

  isAuthenticated: () => get().token !== null && get().user !== null,

  ensureAuthenticated: async () => {
    const existingToken = get().token;
    if (existingToken) {
      // 已有 token，不重复建号（TODO 计划后续：从 IndexedDB 恢复 + 校验）
      return;
    }

    set({ loading: true, error: null });
    try {
      const { user, token } = await versusApi.createAnonymous();
      set({ user, token, loading: false });
      // TODO 计划后续：持久化 token 到 IndexedDB
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
      throw e;
    }
  },

  reset: () => set({ user: null, token: null, loading: false, error: null }),
}));
