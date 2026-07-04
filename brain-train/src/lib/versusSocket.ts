// Socket.IO 连接管理：单例连接，带 token 鉴权
import { io, type Socket } from 'socket.io-client';

const SOCKET_BASE = import.meta.env.VITE_VERSUS_API_BASE ?? 'http://localhost:3001';

let socket: Socket | null = null;

// 连接到对战服务器（带 token）。单例：已连接则复用。
export function connectVersus(token: string): Socket {
  if (socket) return socket;

  socket = io(SOCKET_BASE, {
    auth: { token },
  });

  socket.on('connect_error', (err) => {
    console.error('[versus] socket 连接失败:', err.message);
  });

  return socket;
}

// 获取当前连接（未连接返回 null）
export function getSocket(): Socket | null {
  return socket;
}

// 断开连接
export function disconnectVersus(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
