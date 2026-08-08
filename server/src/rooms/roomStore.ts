// 房间内存存储：Map<roomId, Room>。不进 DB，进程重启即清空。
import { randomUUID } from 'node:crypto';
import type { Room, Player, PublicRoom, GameMode, RoundMode } from '../types/room.js';
import { toPublicRoom } from './roomHelpers.js';

export interface RoomStore {
  create(
    hostId: string,
    host: Player,
    opts: { name?: string; roundMode: RoundMode; games: GameMode[] },
  ): Room;
  get(roomId: string): Room | null;
  findByPlayerId(userId: string): Room | null;
  findPublic(): PublicRoom[];
  update(roomId: string, mutator: (room: Room) => void): Room | null;
  remove(roomId: string): void;
  count(): number;
}

export function createRoomStore(): RoomStore {
  const rooms = new Map<string, Room>();

  return {
    create(hostId, host, opts) {
      const roomId = randomUUID();
      const games = opts.games.length > 0 ? opts.games : ['schulte' as GameMode];
      const room: Room = {
        roomId,
        name: opts.name ?? `${host.name}的房间`,
        hostId,
        state: 'waiting',
        gameMode: games[0],
        maxPlayers: 2,
        players: [host],
        createdAt: Date.now(),
        roundMode: opts.roundMode,
        gameQueue: games,
        currentQueueIndex: 0,
        roundResults: [],
        hostCanChangeGames: false,
      };
      rooms.set(roomId, room);
      return room;
    },

    get(roomId) {
      return rooms.get(roomId) ?? null;
    },

    findByPlayerId(userId) {
      for (const room of rooms.values()) {
        if (room.players.some((p) => p.id === userId)) return room;
      }
      return null;
    },

    findPublic() {
      const pubs: PublicRoom[] = [];
      for (const room of rooms.values()) {
        const pub = toPublicRoom(room);
        if (pub) pubs.push(pub);
      }
      return pubs;
    },

    update(roomId, mutator) {
      const room = rooms.get(roomId);
      if (!room) return null;
      mutator(room);
      return room;
    },

    remove(roomId) {
      rooms.delete(roomId);
    },

    count() {
      return rooms.size;
    },
  };
}
