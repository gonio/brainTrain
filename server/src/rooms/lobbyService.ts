// 大厅服务：管理订阅者集合 + 封装广播。通过注入的 emit 回调发送，便于单测。
import type { PublicRoom } from '../types/room.js';

// emit 回调签名：(socketId, event, payload) => void
export type EmitFn = (socketId: string, event: string, payload: unknown) => void;

export interface LobbyService {
  subscribe(socketId: string, currentList: PublicRoom[]): void;
  unsubscribe(socketId: string): void;
  broadcastRoomAdded(room: PublicRoom): void;
  broadcastRoomChanged(room: PublicRoom): void;
  broadcastRoomRemoved(roomId: string): void;
}

export function createLobbyService(emit: EmitFn): LobbyService {
  const subscribers = new Set<string>();

  return {
    subscribe(socketId, currentList) {
      subscribers.add(socketId);
      emit(socketId, 'lobby:list', currentList);
    },

    unsubscribe(socketId) {
      subscribers.delete(socketId);
    },

    broadcastRoomAdded(room) {
      for (const sid of subscribers) {
        emit(sid, 'lobby:roomAdded', room);
      }
    },

    broadcastRoomChanged(room) {
      for (const sid of subscribers) {
        emit(sid, 'lobby:roomChanged', room);
      }
    },

    broadcastRoomRemoved(roomId) {
      for (const sid of subscribers) {
        emit(sid, 'lobby:roomRemoved', { roomId });
      }
    },
  };
}
