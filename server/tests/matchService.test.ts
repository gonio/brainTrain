import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createMatchService } from '../src/rooms/matchService.js';
import type { Player } from '../src/types/room.js';

const player = (id: string): Player => ({
  id, socketId: `s-${id}`, name: `玩家${id}`, avatar: '🦊',
  ready: true, isHost: true, connected: true,
});

describe('matchService', () => {
  let match: ReturnType<typeof createMatchService>;
  let onMatched: ReturnType<typeof vi.fn>;
  let onTimeout: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    onMatched = vi.fn();
    onTimeout = vi.fn();
    match = createMatchService({ onMatched, onTimeout, timeoutMs: 30000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('第一个入队：不立即配对，等待', () => {
    match.enqueue('p1', player('p1'));
    expect(onMatched).not.toHaveBeenCalled();
  });

  it('第二个入队：立即配对，触发 onMatched（含两人信息）', () => {
    match.enqueue('p1', player('p1'));
    match.enqueue('p2', player('p2'));
    expect(onMatched).toHaveBeenCalledTimes(1);
    const [a, b] = onMatched.mock.calls[0];
    expect([a.id, b.id].sort()).toEqual(['p1', 'p2']);
  });

  it('配对后双方都出队', () => {
    match.enqueue('p1', player('p1'));
    match.enqueue('p2', player('p2'));
    match.enqueue('p3', player('p3'));
    expect(onMatched).toHaveBeenCalledTimes(1);
  });

  it('cancel 把玩家移出队列', () => {
    match.enqueue('p1', player('p1'));
    match.cancel('p1');
    match.enqueue('p2', player('p2'));
    expect(onMatched).not.toHaveBeenCalled();
  });

  it('cancel 不存在的玩家：无副作用', () => {
    expect(() => match.cancel('不存在')).not.toThrow();
  });

  it('超时：30s 后触发 onTimeout', () => {
    match.enqueue('p1', player('p1'));
    vi.advanceTimersByTime(30000);
    expect(onTimeout).toHaveBeenCalledWith('p1');
  });

  it('配对成功后清除超时定时器（不再触发 onTimeout）', () => {
    match.enqueue('p1', player('p1'));
    match.enqueue('p2', player('p2'));
    vi.advanceTimersByTime(30000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('cancel 后清除超时定时器', () => {
    match.enqueue('p1', player('p1'));
    match.cancel('p1');
    vi.advanceTimersByTime(30000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('已在队列中再次 enqueue：不重复（幂等）', () => {
    match.enqueue('p1', player('p1'));
    match.enqueue('p1', player('p1'));
    match.enqueue('p2', player('p2'));
    expect(onMatched).toHaveBeenCalledTimes(1);
  });
});
