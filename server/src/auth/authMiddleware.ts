// Express 中间件：从 Authorization: Bearer <token> 取 token，查 user，挂到 req.user
import type { Request, Response, NextFunction } from 'express';
import { findUserByToken } from './authRepository.js';
import type { User } from '../types.js';

// 扩展 Express Request 类型，加 user 字段
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// 从 Authorization 头解析 Bearer token
function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  return match ? match[1] : null;
}

// 受保护路由用：要求有效 token
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: '未提供 token' });
    return;
  }

  const user = await findUserByToken(token);
  if (!user) {
    res.status(401).json({ error: 'token 无效' });
    return;
  }

  req.user = user;
  next();
}
