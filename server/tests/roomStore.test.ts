import { describe, it, expect, beforeEach } from 'vitest';
import { createRoomStore } from '../src/rooms/roomStore.js';
import type { Player } from '../src/types/room.js';

const player = (id: string, isHost = false): Player => ({
  id, socketId: `s-${id}`, name: `玩家${id}`, avatar: '🦊',
  ready: true, isHost, connected: true,
});

describe('roomStore', () => {
  let store: ReturnType<typeof createRoomStore>;

  beforeEach(() => {
    store = createRoomStore();
  });

  it('create 建房并返回 room', () => {
    const room = store.create('h1', player('h1', true), { roundMode: 'single', games: ['schulte'] });
    expect(room.roomId).toBeTruthy();
    expect(room.hostId).toBe('h1');
    expect(room.state).toBe('waiting');
    expect(room.players).toHaveLength(1);
    expect(room.maxPlayers).toBe(2);
  });

  it('get 按 roomId 查', () => {
    const created = store.create('h1', player('h1', true), { roundMode: 'single', games: ['schulte'] });
    expect(store.get(created.roomId)?.roomId).toBe(created.roomId);
  });

  it('get 不存在返回 null', () => {
    expect(store.get('不存在')).toBeNull();
  });

  it('findByPlayerId 按 userId 查房间', () => {
    const created = store.create('h1', player('h1', true), { roundMode: 'single', games: ['schulte'] });
    expect(store.findByPlayerId('h1')?.roomId).toBe(created.roomId);
  });

  it('findPublic 返回所有 waiting/ready 房间的投影', () => {
    store.create('h1', player('h1', true), { roundMode: 'single', games: ['schulte'] });
    store.create('h2', player('h2', true), { roundMode: 'single', games: ['schulte'] });
    const pubs = store.findPublic();
    expect(pubs).toHaveLength(2);
    pubs.forEach((p) => {
      expect(p.state).toMatch(/waiting|ready/);
    });
  });

  it('findPublic 不返回 playing/finished 房间', () => {
    const r = store.create('h1', player('h1', true), { roundMode: 'single', games: ['schulte'] });
    store.update(r.roomId, (room) => { room.state = 'playing'; });
    expect(store.findPublic()).toHaveLength(0);
  });

  it('update 更新房间（返回更新后的 room）', () => {
    const r = store.create('h1', player('h1', true), { roundMode: 'single', games: ['schulte'] });
    const updated = store.update(r.roomId, (room) => {
      room.state = 'ready';
    });
    expect(updated?.state).toBe('ready');
    expect(store.get(r.roomId)?.state).toBe('ready');
  });

  it('update 不存在返回 null', () => {
    expect(store.update('不存在', () => {})).toBeNull();
  });

  it('remove 删除房间', () => {
    const r = store.create('h1', player('h1', true), { roundMode: 'single', games: ['schulte'] });
    store.remove(r.roomId);
    expect(store.get(r.roomId)).toBeNull();
  });

  it('count 统计房间数', () => {
    expect(store.count()).toBe(0);
    store.create('h1', player('h1', true), { roundMode: 'single', games: ['schulte'] });
    expect(store.count()).toBe(1);
  });
});
