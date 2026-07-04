// 多人对战共享类型（与后端 server/src/types.ts 对应）

// 用户实体
export interface VersusUser {
  id: string;
  username: string;
  avatar: string;
  token: string;
  createdAt: string; // 后端 ISO 字符串
}

// POST /api/auth/anonymous 响应
export interface AuthResult {
  user: VersusUser;
  token: string;
}

// ============ 房间类型（镜像后端 server/src/types/room.ts）============

export type RoomState = 'waiting' | 'ready' | 'countdown' | 'playing' | 'finished' | 'closed';
export type GameMode = 'schulte';

export interface VersusPlayer {
  id: string;
  name: string;
  avatar: string;
  ready: boolean;
  isHost: boolean;
  connected: boolean;
}

export interface PublicRoom {
  roomId: string;
  name: string;
  hostName: string;
  playerCount: number;
  gameMode: GameMode;
  state: 'waiting' | 'ready';
}

// ============ Socket 事件载荷（镜像后端）============

// S→C: room:state
export interface RoomStatePayload {
  roomId: string;
  name: string;
  state: RoomState;
  players: VersusPlayer[];
  gameMode: GameMode;
}

// S→C: match:found
export interface MatchFoundPayload {
  roomId: string;
  opponent: { id: string; name: string; avatar: string };
}

// S→C: game:start
export interface GameStartPayload {
  grid: number[];
  startTime: number;
  size: number;
  target: number;
  timeLimitMs: number;
}

// S→C: game:progress
export interface GameProgressPayload {
  me: { found: number; errors: number; done: boolean };
  opponent: { found: number; errors: number; done: boolean };
}

export interface PlayerResult {
  playerId: string;
  found: number;
  errors: number;
  accuracy: number;
  timeMs: number;
  done: boolean;
  won: boolean;
}

// S→C: game:end
export interface GameEndPayload {
  winner: 'me' | 'opponent' | 'draw';
  myResult: PlayerResult;
  opponentResult: PlayerResult;
}

// S→C: room:countdown
export interface CountdownPayload {
  remaining: number;
}

// S→C: room:error / lobby 事件
export interface RoomErrorPayload {
  message: string;
}
