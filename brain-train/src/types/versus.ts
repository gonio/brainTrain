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
