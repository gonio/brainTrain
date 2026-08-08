// 舒尔特对战游戏类型（C 阶段）

// 单个玩家的权威进度（服务器内存态）
export interface PlayerProgress {
  playerId: string;
  found: number;          // 已正确点数
  errors: number;         // 错点次数
  done: boolean;          // 是否点完（found == target）
  finishTime: number | null;  // 点完时刻（ms 时间戳），用于裁定
}

// 一局对战的服务器权威状态
export interface RoomGame {
  roomId: string;
  grid: number[];         // 权威的舒尔特表（如 [5,12,1,...] 共 25 项）
  startTime: number;      // 游戏开始时刻（ms）
  timeLimitMs: number;    // 时间上限（如 90000）
  target: number;         // 要点完的总数（= grid.length）
  players: Map<string, PlayerProgress>;  // playerId → 进度
  ended: boolean;
}

// S→C: game:start 下发给双方
export interface GameStartPayload {
  grid: number[];
  startTime: number;
  size: number;           // 如 5（5x5）
  target: number;
  timeLimitMs: number;
}

// S→C: game:progress 每 500ms 广播
export interface GameProgressPayload {
  me: { found: number; errors: number; done: boolean };
  opponent: { found: number; errors: number; done: boolean };
}

// 单个玩家的最终结果（game:end 里用）
export interface PlayerResult {
  playerId: string;
  found: number;
  errors: number;         // 已补齐的最终 errors（含没点完的）
  accuracy: number;       // 0-1
  timeMs: number;         // 用时（点完用 finishTime-startTime，没点完用 timeLimitMs）
  done: boolean;
  won: boolean;
}

// S→C: game:end 胜负裁定
export interface GameEndPayload {
  winner: 'me' | 'opponent' | 'draw';
  myResult: PlayerResult;
  opponentResult: PlayerResult;
  detail?: Record<string, unknown>;
}

// game:tap 处理后的即时结果（可选，第一版客户端本地判断，不强制下发）
export interface TapResult {
  cellIndex: number;
  correct: boolean;
}
