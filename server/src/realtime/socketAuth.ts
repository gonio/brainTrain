// Socket.IO 鉴权中间件：连接时校验 handshake.auth.token
import type { Server as SocketIOServer, Socket } from 'socket.io';
import { findUserByToken } from '../auth/authRepository.js';

// 给 Socket 实例扩展 userId 字段
declare module 'socket.io' {
  interface Socket {
    userId?: string;
    userName?: string;
    userAvatar?: string;
  }
}

export function attachAuthMiddleware(io: SocketIOServer): void {
  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error('未提供 token'));
      return;
    }

    const user = await findUserByToken(token);
    if (!user) {
      next(new Error('token 无效'));
      return;
    }

    // 把用户信息挂到 socket 上，后续房间/对战逻辑用
    socket.userId = user.id;
    socket.userName = user.username;
    socket.userAvatar = user.avatar;
    next();
  });
}
