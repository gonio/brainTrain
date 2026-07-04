// 房间领域类型（B 阶段：Room Engine + 大厅 + 匹配）

// 房间状态机
export type RoomState =
  | 'waiting'      // 房主创建后等人
  | 'ready'        // 人齐，双方有准备状态
  | 'countdown'    // 3-2-1 倒计时
  | 'playing'      // 对战进行中（计划三启用）
  | 'finished'     // 结果已裁定（计划三启用）
  | 'closed';      // 房间销毁

// 游戏模式（首版只有舒尔特，字段为后续扩展留口）
export type GameMode = 'schulte';

// 房间内玩家
export interface Player {
  id: string;        // = socket.userId
  socketId: string;  // 当前连接的 socket.id
  name: string;      // 用户名
  avatar: string;    // emoji 头像
  ready: boolean;    // 准备状态
  isHost: boolean;   // 是否房主
  connected: boolean; // 当前是否在线（断线标记）
}

// 房间（服务器内存态）
export interface Room {
  roomId: string;
  name: string;        // 房主昵称 + "的房间"
  hostId: string;      // 房主 userId
  state: RoomState;
  gameMode: GameMode;
  maxPlayers: number;  // 参数化，为后续扩到 4/8 留口（首版 2）
  players: Player[];
  createdAt: number;
}

// 大厅列表展示用（Room 的投影，去敏感字段）
export interface PublicRoom {
  roomId: string;
  name: string;
  hostName: string;
  playerCount: number;
  gameMode: GameMode;
  state: 'waiting' | 'ready';  // 只列等人中的房间
}

// ============ Socket.IO 事件载荷类型 ============

// S→C: room:state 广播给房间内所有人
export interface RoomStatePayload {
  roomId: string;
  name: string;
  state: RoomState;
  players: Player[];
  gameMode: GameMode;
}

// S→C: match:found
export interface MatchFoundPayload {
  roomId: string;
  opponent: { id: string; name: string; avatar: string };
}

// C→S: room:create
export interface RoomCreateInput {
  name?: string;
}

// C→S: room:join
export interface RoomJoinInput {
  roomId: string;
}

// C→S: player:ready
export interface PlayerReadyInput {
  ready: boolean;
}
