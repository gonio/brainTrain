import { describe, it, expect, vi, beforeEach } from 'vitest';
import { io as mockIo } from 'socket.io-client';

// mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  })),
}));

import { connectVersus, disconnectVersus } from '../../src/lib/versusSocket';

beforeEach(() => {
  vi.clearAllMocks();
  disconnectVersus();
});

describe('versusSocket', () => {
  it('connectVersus 带 token 调用 io() 连接', () => {
    connectVersus('my-token');

    expect(mockIo).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ auth: { token: 'my-token' } })
    );
  });

  it('重复 connectVersus 不重复创建连接', () => {
    connectVersus('token-a');
    connectVersus('token-a');

    expect(mockIo).toHaveBeenCalledTimes(1);
  });

  it('disconnectVersus 断开连接', () => {
    connectVersus('token-a');
    disconnectVersus();

    // 再次 connect 应该会创建新连接
    connectVersus('token-a');
    expect(mockIo).toHaveBeenCalledTimes(2);
  });
});
