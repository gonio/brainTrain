// Auth 路由：POST /api/auth/anonymous（建匿名号）、GET /api/auth/me（查当前用户）
import { Router } from 'express';
import { generateUsername, generateAvatar, generateToken } from './authService.js';
import { createUser } from './authRepository.js';
import { requireAuth } from './authMiddleware.js';
import type { AuthResult } from '../types.js';

export const authRouter = Router();

// 建匿名账号
authRouter.post('/anonymous', async (_req, res) => {
  const user = await createUser({
    username: generateUsername(),
    avatar: generateAvatar(),
    token: generateToken(),
  });

  const result: AuthResult = { user, token: user.token };
  res.json(result);
});

// 查当前用户（受保护）
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
