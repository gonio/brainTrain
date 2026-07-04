// 多人对战共享类型

// 用户实体（数据库行映射）
export interface User {
  id: string;
  username: string;
  avatar: string;
  token: string;
  createdAt: Date;
}

// POST /api/auth/anonymous 的响应
export interface AuthResult {
  user: User;
  token: string;
}

// Socket.IO 连接鉴权载荷（客户端在 handshake.auth 里带）
export interface SocketAuthPayload {
  token: string;
}
