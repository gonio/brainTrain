import { describe, it, expect, beforeEach } from 'vitest';
import { createGameStore } from '../src/schulte/gameStore.js';

describe('gameStore', () => {
  let store: ReturnType<typeof createGameStore>;

  beforeEach(() => {
    store = createGameStore();
  });

  it('create 建一局游戏，初始化双方进度', () => {
    const game = store.create({
      roomId: 'r1',
      grid: [1, 2, 3, 4],
      startTime: 1000,
      timeLimitMs: 90000,
      target: 4,
      playerIds: ['p1', 'p2'],
    });
    expect(game.roomId).toBe('r1');
    expect(game.grid).toEqual([1, 2, 3, 4]);
    expect(game.target).toBe(4);
    expect(game.ended).toBe(false);
    expect(game.players.get('p1')).toEqual({ playerId: 'p1', found: 0, errors: 0, done: false, finishTime: null });
    expect(game.players.get('p2')).toEqual({ playerId: 'p2', found: 0, errors: 0, done: false, finishTime: null });
  });

  it('get 按 roomId 查', () => {
    store.create({ roomId: 'r1', grid: [1], startTime: 0, timeLimitMs: 90, target: 1, playerIds: ['p1', 'p2'] });
    expect(store.get('r1')?.roomId).toBe('r1');
  });

  it('get 不存在返回 null', () => {
    expect(store.get('不存在')).toBeNull();
  });

  it('updateProgress 更新某玩家进度', () => {
    store.create({ roomId: 'r1', grid: [1, 2], startTime: 0, timeLimitMs: 90, target: 2, playerIds: ['p1', 'p2'] });
    store.updateProgress('r1', 'p1', { found: 1 });
    expect(store.get('r1')?.players.get('p1')?.found).toBe(1);
  });

  it('updateProgress 不存在的游戏返回 false', () => {
    expect(store.updateProgress('不存在', 'p1', { found: 1 })).toBe(false);
  });

  it('markEnded 标记结束', () => {
    store.create({ roomId: 'r1', grid: [1], startTime: 0, timeLimitMs: 90, target: 1, playerIds: ['p1', 'p2'] });
    store.markEnded('r1');
    expect(store.get('r1')?.ended).toBe(true);
  });

  it('remove 删除', () => {
    store.create({ roomId: 'r1', grid: [1], startTime: 0, timeLimitMs: 90, target: 1, playerIds: ['p1', 'p2'] });
    store.remove('r1');
    expect(store.get('r1')).toBeNull();
  });
});
