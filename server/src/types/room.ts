// 房间领域类型（B 阶段：Room Engine + 大厅 + 匹配）

// 房间状态机
export type RoomState =
  | 'waiting'      // 房主创建后等人
  | 'ready'        // 人齐，双方有准备状态
  | 'countdown'    // 3-2-1 倒计时
  | 'playing'      // 对战进行中（计划三启用）
  | 'finished'     // 结果已裁定（计划三启用）
  | 'closed';      // 房间销毁

// 游戏模式（计划三：四游戏支持）
export type GameMode = 'schulte' | 'stroop' | 'sequence' | 'bottle';

// 本轮编排模式（单局 / 多局队列）
export type RoundMode = 'single' | 'multi';

// 单局结果（多局模式下逐局累积）
export interface RoundGameResult {
  gameMode: GameMode;
  queueIndex: number;
  results: { playerId: string; won: boolean; accuracy: number; timeMs: number }[];
}

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
  // ===== 新增：本轮多局编排 =====
  roundMode: RoundMode;
  gameQueue: GameMode[];
  currentQueueIndex: number;
  roundResults: RoundGameResult[];
  hostCanChangeGames: boolean;
}

// 大厅列表展示用（Room 的投影，去敏感字段）
export interface PublicRoom {
  roomId: string;
  name: string;
  hostName: string;
  playerCount: number;
  gameMode: GameMode;
  state: 'waiting' | 'ready';  // 只列等人中的房间
  roundMode: RoundMode;
  totalInRound: number;
}

// ============ Socket.IO 事件载荷类型 ============

// S→C: room:state 广播给房间内所有人
export interface RoomStatePayload {
  roomId: string;
  name: string;
  state: RoomState;
  players: Player[];
  gameMode: GameMode;
  roundMode: RoundMode;
  gameQueue: GameMode[];
  currentQueueIndex: number;
  totalInRound: number;
  hostCanChangeGames: boolean;
  roundResults: RoundGameResult[];
}

// S→C: match:found
export interface MatchFoundPayload {
  roomId: string;
  opponent: { id: string; name: string; avatar: string };
}

// C→S: room:create
export interface RoomCreateInput {
  name?: string;
  roundMode: RoundMode;
  games: GameMode[];
}

// C→S: room:reconfigure（房主本轮改游戏/模式，仅 hostCanChangeGames 时可调）
export interface RoomReconfigureInput {
  roundMode: RoundMode;
  games: GameMode[];
}

// C→S: room:join
export interface RoomJoinInput {
  roomId: string;
}

// C→S: player:ready
export interface PlayerReadyInput {
  ready: boolean;
}

// ============ 通用游戏事件载荷类型（计划三） ============

// 通用 game:start（seed 结构由 GameEngine 定义，这里用 unknown 占位，引擎模块自带类型）
export interface GameStartPayload {
  mode: GameMode;
  seed: unknown;            // 各引擎的 GameSeed 联合类型，见 server/src/games/types.ts
  startTime: number;
  timeLimitMs: number;
  queueIndex: number;
  totalInRound: number;
}

// C→S: game:action（按 mode 区分的动作）
export interface GameActionInput {
  mode: GameMode;
  payload: unknown;         // 各引擎的 GameAction 子类型
}

// 通用 game:progress（归一化百分比）
export interface GameProgressPayload {
  mode: GameMode;
  me: { percent: number; done: boolean };
  opponent: { percent: number; done: boolean };
}

// S→C: room:nextRound（多局推进）
export interface NextRoundPayload {
  nextMode: GameMode;
  queueIndex: number;
  totalInRound: number;
  roundResults: RoundGameResult[];
}

// S→C: room:roundEnd（本轮全部结束）
export interface RoundEndPayload {
  roundResults: RoundGameResult[];
}

// S→C: game:grace（字色先完成者触发对方宽限倒计时）
export interface GracePayload {
  seconds: number;
}
