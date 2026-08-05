import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../../src/stores/authStore';
import { versusApi } from '../../src/lib/versusApi';
import { db } from '../../src/db';

// mock versusApi
vi.mock('../../src/lib/versusApi', () => ({
  versusApi: {
    createAnonymous: vi.fn(),
    getMe: vi.fn(),
    updateMe: vi.fn(),
  },
}));

const AUTH_RECORD_ID = 'current';

beforeEach(async () => {
  useAuthStore.getState().reset();
  vi.clearAllMocks();
  // 清空 token 表，避免上一个用例残留
  await db.versusAuth.clear();
});

describe('authStore', () => {
  it('初始状态：未登录、无 token、无 user', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated()).toBe(false);
  });

  it('ensureAuthenticated 无 token 时自动建号并持久化', async () => {
    const mockUser = { id: 'u1', username: '迅捷猎豹#3F7K', avatar: '🦊', token: 'tok1', createdAt: '2026-01-01' };
    vi.mocked(versusApi.createAnonymous).mockResolvedValue({
      user: mockUser,
      token: 'tok1',
    });

    await useAuthStore.getState().ensureAuthenticated();

    expect(versusApi.createAnonymous).toHaveBeenCalled();
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().token).toBe('tok1');
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);

    // token 已写入 IndexedDB
    const rec = await db.versusAuth.get(AUTH_RECORD_ID);
    expect(rec?.token).toBe('tok1');
    expect(rec?.userId).toBe('u1');
  });

  it('ensureAuthenticated 已初始化则跳过', async () => {
    // 标记为已初始化，模拟启动已完成的场景
    useAuthStore.setState({ initialized: true });

    await useAuthStore.getState().ensureAuthenticated();

    // 不应再调 createAnonymous / getMe
    expect(versusApi.createAnonymous).not.toHaveBeenCalled();
    expect(versusApi.getMe).not.toHaveBeenCalled();
  });

  it('ensureAuthenticated 有持久化 token 时走 getMe 恢复', async () => {
    // 预置 token 到 IndexedDB
    await db.versusAuth.put({ id: AUTH_RECORD_ID, token: 'stored-tok', userId: 'u-existing' });
    const mockUser = { id: 'u-existing', username: '老用户#AB12', avatar: '🐯', token: 'stored-tok', createdAt: '2026-01-01' };
    vi.mocked(versusApi.getMe).mockResolvedValue(mockUser);

    await useAuthStore.getState().ensureAuthenticated();

    // 走 getMe 分支，不调 createAnonymous
    expect(versusApi.getMe).toHaveBeenCalledWith('stored-tok');
    expect(versusApi.createAnonymous).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().token).toBe('stored-tok');
  });

  it('ensureAuthenticated token 失效时落到新建', async () => {
    await db.versusAuth.put({ id: AUTH_RECORD_ID, token: 'bad-tok', userId: 'u-old' });
    vi.mocked(versusApi.getMe).mockRejectedValue(new Error('token 校验失败: 401'));
    const mockUser = { id: 'u-new', username: '新用户#XYZ', avatar: '🐱', token: 'new-tok', createdAt: '2026-01-01' };
    vi.mocked(versusApi.createAnonymous).mockResolvedValue({ user: mockUser, token: 'new-tok' });

    await useAuthStore.getState().ensureAuthenticated();

    expect(versusApi.createAnonymous).toHaveBeenCalled();
    expect(useAuthStore.getState().token).toBe('new-tok');
  });
});
