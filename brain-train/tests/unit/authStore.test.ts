import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../../src/stores/authStore';
import { versusApi } from '../../src/lib/versusApi';

// mock versusApi
vi.mock('../../src/lib/versusApi', () => ({
  versusApi: {
    createAnonymous: vi.fn(),
  },
}));

beforeEach(() => {
  useAuthStore.getState().reset();
  vi.clearAllMocks();
});

describe('authStore', () => {
  it('初始状态：未登录、无 token、无 user', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated()).toBe(false);
  });

  it('ensureAuthenticated 无 token 时自动建号', async () => {
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
  });

  it('ensureAuthenticated 有 token 时不重复建号', async () => {
    // 先手动设置已有 token
    useAuthStore.setState({ token: 'existing-tok' });

    await useAuthStore.getState().ensureAuthenticated();

    // 不应再调 createAnonymous
    expect(versusApi.createAnonymous).not.toHaveBeenCalled();
  });
});
