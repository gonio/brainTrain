import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLobbyService } from '../src/rooms/lobbyService.js';
import type { PublicRoom } from '../src/types/room.js';

const pub = (id: string, name = `房${id}`, count = 1): PublicRoom => ({
  roomId: id, name, hostName: `房主${id}`, playerCount: count, gameMode: 'schulte', state: 'waiting',
});

describe('lobbyService', () => {
  let lobby: ReturnType<typeof createLobbyService>;
  let emit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    emit = vi.fn();
    lobby = createLobbyService(emit);
  });

  describe('订阅', () => {
    it('subscribe 注册订阅者并发送当前列表', () => {
      lobby.subscribe('sock1', [pub('r1')]);
      expect(emit).toHaveBeenCalledWith('sock1', 'lobby:list', [pub('r1')]);
    });

    it('unsubscribe 移除订阅者（之后不再收广播）', () => {
      lobby.subscribe('sock1', []);
      lobby.unsubscribe('sock1');
      emit.mockClear();
      lobby.broadcastRoomAdded(pub('r2'));
      expect(emit).not.toHaveBeenCalled();
    });

    it('重复 subscribe 不重复注册（幂等，但每次都重发 list 刷新）', () => {
      lobby.subscribe('sock1', []);
      lobby.subscribe('sock1', []);
      emit.mockClear();
      lobby.broadcastRoomAdded(pub('r2'));
      // 只有一个订阅者，广播只调一次
      expect(emit).toHaveBeenCalledTimes(1);
    });
  });

  describe('广播增删改', () => {
    beforeEach(() => {
      lobby.subscribe('sock1', []);
      lobby.subscribe('sock2', []);
      emit.mockClear();
    });

    it('broadcastRoomAdded 通知所有订阅者', () => {
      lobby.broadcastRoomAdded(pub('r1'));
      expect(emit).toHaveBeenCalledWith('sock1', 'lobby:roomAdded', pub('r1'));
      expect(emit).toHaveBeenCalledWith('sock2', 'lobby:roomAdded', pub('r1'));
    });

    it('broadcastRoomChanged 通知所有订阅者', () => {
      const changed = { ...pub('r1'), playerCount: 2, state: 'ready' as const };
      lobby.broadcastRoomChanged(changed);
      expect(emit).toHaveBeenCalledWith('sock1', 'lobby:roomChanged', changed);
      expect(emit).toHaveBeenCalledWith('sock2', 'lobby:roomChanged', changed);
    });

    it('broadcastRoomRemoved 通知所有订阅者', () => {
      lobby.broadcastRoomRemoved('r1');
      expect(emit).toHaveBeenCalledWith('sock1', 'lobby:roomRemoved', { roomId: 'r1' });
      expect(emit).toHaveBeenCalledWith('sock2', 'lobby:roomRemoved', { roomId: 'r1' });
    });

    it('没有订阅者时不调用 emit', () => {
      const emptyLobby = createLobbyService(emit);
      emptyLobby.broadcastRoomAdded(pub('r1'));
      expect(emit).not.toHaveBeenCalled();
    });
  });
});
