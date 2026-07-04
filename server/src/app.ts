// 组装 Express app + Socket.IO server，共享一个 HTTP server
import express, { type Express } from 'express';
import cors from 'cors';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config.js';
import { authRouter } from './auth/authRoutes.js';
import { leaderboardRouter } from './stats/leaderboardRoutes.js';
import { attachAuthMiddleware } from './realtime/socketAuth.js';
import { attachRoomHandlers } from './rooms/index.js';

export interface AppBundle {
  app: Express;
  httpServer: HttpServer;
  io: SocketIOServer;
}

// 组装 app（不监听端口，测试和启动复用）
export function buildApp(): AppBundle {
  const app = express();
  app.use(express.json());
  app.use(cors({ origin: config.corsOrigin }));

  // 健康检查
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Auth 路由
  app.use('/api/auth', authRouter);

  // 排行榜 + 个人统计
  app.use('/api', leaderboardRouter);

  // HTTP server + Socket.IO（共享）
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: config.corsOrigin },
  });
  attachAuthMiddleware(io);
  attachRoomHandlers(io);

  return { app, httpServer, io };
}
