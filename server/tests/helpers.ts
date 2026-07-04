// 测试用：组装一个独立的 Express app（不启动 server 监听）
import express, { type Express } from 'express';
import cors from 'cors';
import { config } from '../src/config.js';
import { authRouter } from '../src/auth/authRoutes.js';

export async function buildTestApp(): Promise<Express> {
  const app = express();
  app.use(express.json());
  app.use(cors({ origin: config.corsOrigin }));
  app.use('/api/auth', authRouter);
  return app;
}
