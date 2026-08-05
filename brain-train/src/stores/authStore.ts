// 多人对战 auth store：管理 token/user 状态，启动自动建号、token 持久化
import { create } from 'zustand';
import type { VersusUser } from '../types/versus';
import { versusApi } from '../lib/versusApi';
import { db } from '../db';

interface AuthState {
  user: VersusUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;  // 启动初始化是否完成

  // 确保已登录：启动时调用，先从 IndexedDB 恢复 token，否则自动建号
  ensureAuthenticated: () => Promise<void>;
  // 更新昵称/头像（同步到服务端 + 本地 profile）
  updateProfile: (patch: { username?: string; avatar?: string }) => Promise<void>;
  // 重置（测试用 + 登出）
  reset: () => void;
  // 判断是否已登录
  isAuthenticated: () => boolean;
}

const AUTH_RECORD_ID = 'current';

// 从 IndexedDB 读 token
async function loadToken(): Promise<string | null> {
  const rec = await db.versusAuth.get(AUTH_RECORD_ID);
  return rec?.token ?? null;
}

// 存 token 到 IndexedDB
async function saveToken(token: string, userId: string): Promise<void> {
  await db.versusAuth.put({ id: AUTH_RECORD_ID, token, userId });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  loading: false,
  error: null,
  initialized: false,

  isAuthenticated: () => get().token !== null && get().user !== null,

  ensureAuthenticated: async () => {
    // 已初始化则跳过
    if (get().initialized) return;

    set({ loading: true, error: null });
    try {
      // 1. 先从 IndexedDB 恢复 token
      const storedToken = await loadToken();
      if (storedToken) {
        try {
          const user = await versusApi.getMe(storedToken);
          set({ user, token: storedToken, loading: false, initialized: true });
          return;
        } catch {
          // token 失效，落到新建
        }
      }

      // 2. 读本地 profile 的昵称头像作为 preferred（如果用户自定义过）
      let preferred: { preferredUsername?: string; preferredAvatar?: string } | undefined;
      try {
        const profile = await db.userProfile.get('default');
        if (profile && profile.displayName && profile.displayName !== '用户') {
          preferred = { preferredUsername: profile.displayName, preferredAvatar: profile.avatar };
        }
      } catch {
        // profile 读不到没关系
      }

      // 3. 建新号
      const { user, token } = await versusApi.createAnonymous(preferred);
      await saveToken(token, user.id);
      set({ user, token, loading: false, initialized: true });

      // 4. 同步到本地 profile（让主页/单人模式也用这个名）
      try {
        const profile = await db.userProfile.get('default');
        if (profile) {
          await db.userProfile.put({
            ...profile,
            displayName: user.username,
            avatar: user.avatar,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch {
        // 同步失败不影响建号
      }
    } catch (e) {
      set({ loading: false, error: (e as Error).message, initialized: true });
    }
  },

  updateProfile: async (patch) => {
    const token = get().token;
    if (!token) throw new Error('未登录');
    const updatedUser = await versusApi.updateMe(token, patch);
    set({ user: updatedUser });
    // 同步到本地 profile
    try {
      const profile = await db.userProfile.get('default');
      if (profile) {
        await db.userProfile.put({
          ...profile,
          displayName: updatedUser.username,
          avatar: updatedUser.avatar,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {
      // 本地同步失败不影响服务端
    }
  },

  reset: () => set({ user: null, token: null, loading: false, error: null, initialized: false }),
}));
