// Auth 路由：POST /api/auth/anonymous（建匿名号）、GET /api/auth/me（查当前用户）、PUT /api/auth/me（更新昵称/头像）
import { Router } from 'express';
import { createAnonymousUser } from './authService.js';
import { updateUser } from './authRepository.js';
import { requireAuth } from './authMiddleware.js';
import type { AuthResult } from '../types.js';

export const authRouter = Router();

// 建匿名账号（可选 body: { preferredUsername?, preferredAvatar? }）
authRouter.post('/anonymous', async (req, res) => {
  const { preferredUsername, preferredAvatar } = (req.body ?? {}) as { preferredUsername?: string; preferredAvatar?: string };
  try {
    const user = await createAnonymousUser({ preferredUsername, preferredAvatar });
    const result: AuthResult = { user, token: user.token };
    res.json(result);
  } catch {
    res.status(500).json({ error: '建号失败' });
  }
});

// 查当前用户（受保护）
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// 更新当前用户的昵称/头像（受保护）
authRouter.put('/me', requireAuth, async (req, res) => {
  const { username, avatar } = (req.body ?? {}) as { username?: string; avatar?: string };
  if (username !== undefined && (!username.trim() || username.length > 20)) {
    res.status(400).json({ error: '用户名不合法（1-20 字符）' });
    return;
  }
  try {
    const updated = await updateUser(req.user!.id, {
      username: username?.trim() || undefined,
      avatar,
    });
    if (!updated) { res.status(404).json({ error: '用户不存在' }); return; }
    res.json({ user: updated });
  } catch (e) {
    // 唯一约束冲突
    if ((e as { code?: string }).code === '23505') {
      res.status(409).json({ error: '用户名已被占用' });
      return;
    }
    res.status(500).json({ error: '更新失败' });
  }
});
