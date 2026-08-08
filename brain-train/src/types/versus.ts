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
export type GameMode = 'schulte' | 'stroop' | 'sequence' | 'bottle';

// 本轮编排模式（单局 / 多局队列）
export type RoundMode = 'single' | 'multi';

// 单局结果（多局模式下逐局累积）
export interface RoundGameResult {
  gameMode: GameMode;
  queueIndex: number;
  results: { playerId: string; won: boolean; accuracy: number; timeMs: number }[];
}

// 本轮编排信息
export interface RoundInfo {
  roundMode: RoundMode;
  gameQueue: GameMode[];
  currentQueueIndex: number;
  totalInRound: number;
  hostCanChangeGames: boolean;
}

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
  roundMode: RoundMode;
  totalInRound: number;
}

// ============ Socket 事件载荷（镜像后端）============

// S→C: room:state
export interface RoomStatePayload {
  roomId: string;
  name: string;
  state: RoomState;
  players: VersusPlayer[];
  gameMode: GameMode;
  roundMode: RoundMode;
  gameQueue: GameMode[];
  currentQueueIndex: number;
  totalInRound: number;
  hostCanChangeGames: boolean;
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

// S→C: game:end（schulte 专属旧版，保留至 Task 12 切换到 VersusGameEnd）
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

// ===== 多游戏通用类型（取代上面 schulte 专属的 GameStartPayload/GameProgressPayload）=====

// 字色题面（与服务端 StroopQuestionDef 对应）
export interface StroopQuestionDef {
  word: string;
  wordColor: string;
  correctAnswer: string;
  rule: 'standard' | 'reverse';
}

// 服务端下发的 seed（按 mode 区分）
export type VersusSeed =
  | { mode: 'schulte'; grid: number[]; size: number; target: number; direction: 'forward' | 'reverse' | 'random'; order: number[] }
  | { mode: 'stroop'; questions: StroopQuestionDef[]; timePerQuestionSec: number; finishGraceSec: number }
  | { mode: 'sequence'; sequence: string[]; distractors: string[]; optionPool: string[]; memorizeMs: number; recallTimeLimitMs: number }
  | { mode: 'bottle'; targetSequence: string[]; initialSequence: string[] };

// game:start（通用）
export interface VersusGameStart {
  mode: GameMode;
  seed: VersusSeed;
  startTime: number;
  timeLimitMs: number;
  queueIndex: number;
  totalInRound: number;
}

// game:progress（通用，归一化百分比）
export interface VersusGameProgress {
  mode: GameMode;
  me: { percent: number; done: boolean };
  opponent: { percent: number; done: boolean };
}

// game:end 带的 detail（各游戏特有指标）
export interface VersusGameEnd {
  winner: 'me' | 'opponent' | 'draw';
  myResult: PlayerResult;
  opponentResult: PlayerResult;
  detail?: Record<string, unknown>;
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

// ============ 排行榜类型 ============

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar: string;
  matchesPlayed: number;
  avgAccuracy: number;
  avgTimeMs: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  myEntry: LeaderboardEntry | null;
}

export interface MyStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  avgAccuracy: number;
  avgTimeMs: number;
}
