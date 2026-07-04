// 房间纯函数：投影、判断满员/全准备、命名。无副作用。
import type { Room, PublicRoom, RoomStatePayload } from '../types/room.js';

// Room → PublicRoom 投影。非 waiting/ready 状态返回 null（不进大厅列表）。
export function toPublicRoom(room: Room): PublicRoom | null {
  if (room.state !== 'waiting' && room.state !== 'ready') return null;

  const host = room.players.find((p) => p.isHost);
  return {
    roomId: room.roomId,
    name: room.name,
    hostName: host?.name ?? '未知',
    playerCount: room.players.length,
    gameMode: room.gameMode,
    state: room.state,
  };
}

// 房间是否满员
export function isFull(room: Room): boolean {
  return room.players.length >= room.maxPlayers;
}

// 所有玩家是否都准备
export function allReady(room: Room): boolean {
  return room.players.every((p) => p.ready);
}

// 房间命名：房主昵称 + "的房间"
export function makeRoomName(hostName: string): string {
  return `${hostName}的房间`;
}

// Room → 广播载荷
export function toRoomStatePayload(room: Room): RoomStatePayload {
  return {
    roomId: room.roomId,
    name: room.name,
    state: room.state,
    players: room.players,
    gameMode: room.gameMode,
  };
}
