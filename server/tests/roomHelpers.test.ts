import { describe, it, expect } from 'vitest';
import { toPublicRoom, isFull, allReady, makeRoomName, toRoomStatePayload } from '../src/rooms/roomHelpers.js';
import type { Room } from '../src/types/room.js';

const makeRoom = (overrides: Partial<Room> = {}): Room => ({
  roomId: 'r1',
  name: '测试房',
  hostId: 'h1',
  state: 'waiting',
  gameMode: 'schulte',
  maxPlayers: 2,
  createdAt: 1000,
  players: [
    { id: 'h1', socketId: 's1', name: '房主', avatar: '🦊', ready: true, isHost: true, connected: true },
  ],
  ...overrides,
});

describe('roomHelpers', () => {
  describe('toPublicRoom', () => {
    it('把 Room 投影成 PublicRoom，只保留展示字段', () => {
      const room = makeRoom();
      const pub = toPublicRoom(room);
      expect(pub).toEqual({
        roomId: 'r1',
        name: '测试房',
        hostName: '房主',
        playerCount: 1,
        gameMode: 'schulte',
        state: 'waiting',
      });
    });

    it('playing/finished 状态的房间投影返回 null（不进大厅列表）', () => {
      const room = makeRoom({ state: 'playing' });
      expect(toPublicRoom(room)).toBeNull();
    });
  });

  describe('isFull', () => {
    it('人数 < maxPlayers → false', () => {
      expect(isFull(makeRoom({ players: [
        { id: 'a', socketId: 's', name: 'a', avatar: '🦊', ready: true, isHost: true, connected: true },
      ] }))).toBe(false);
    });

    it('人数 == maxPlayers → true', () => {
      expect(isFull(makeRoom({ players: [
        { id: 'a', socketId: 's1', name: 'a', avatar: '🦊', ready: true, isHost: true, connected: true },
        { id: 'b', socketId: 's2', name: 'b', avatar: '🐰', ready: true, isHost: false, connected: true },
      ] }))).toBe(true);
    });
  });

  describe('allReady', () => {
    it('所有玩家 ready=true → true', () => {
      expect(allReady(makeRoom({ players: [
        { id: 'a', socketId: 's1', name: 'a', avatar: '🦊', ready: true, isHost: true, connected: true },
        { id: 'b', socketId: 's2', name: 'b', avatar: '🐰', ready: true, isHost: false, connected: true },
      ] }))).toBe(true);
    });

    it('任一玩家 ready=false → false', () => {
      expect(allReady(makeRoom({ players: [
        { id: 'a', socketId: 's1', name: 'a', avatar: '🦊', ready: true, isHost: true, connected: true },
        { id: 'b', socketId: 's2', name: 'b', avatar: '🐰', ready: false, isHost: false, connected: true },
      ] }))).toBe(false);
    });

    it('空房间 → true（无人未准备，视为满足）', () => {
      expect(allReady(makeRoom({ players: [] }))).toBe(true);
    });
  });

  describe('makeRoomName', () => {
    it('房主昵称 + "的房间"', () => {
      expect(makeRoomName('迅捷猎豹#3F7K')).toBe('迅捷猎豹#3F7K的房间');
    });
  });

  describe('toRoomStatePayload', () => {
    it('转成广播载荷', () => {
      const room = makeRoom();
      const payload = toRoomStatePayload(room);
      expect(payload).toEqual({
        roomId: 'r1',
        name: '测试房',
        state: 'waiting',
        players: room.players,
        gameMode: 'schulte',
      });
    });
  });
});
