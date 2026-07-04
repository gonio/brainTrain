import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildTestApp } from './helpers.js';

// 需要 DB 生命周期
import './setupDb.js';

describe('POST /api/auth/anonymous', () => {
  it('返回 200 + user + token', async () => {
    const app = await buildTestApp();

    const res = await request(app).post('/api/auth/anonymous');

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.user.username).toBeTruthy();
    expect(res.body.user.avatar).toBeTruthy();
    expect(res.body.token).toBe(res.body.user.token);
    expect(typeof res.body.token).toBe('string');
  });

  it('每次调用创建不同用户', async () => {
    const app = await buildTestApp();

    const res1 = await request(app).post('/api/auth/anonymous');
    const res2 = await request(app).post('/api/auth/anonymous');

    expect(res1.body.user.id).not.toBe(res2.body.user.id);
    expect(res1.body.token).not.toBe(res2.body.token);
  });
});

describe('authMiddleware（Bearer token 校验）', () => {
  it('带有效 token 访问受保护路由返回 200', async () => {
    const app = await buildTestApp();

    // 先建号拿 token
    const authRes = await request(app).post('/api/auth/anonymous');
    const token = authRes.body.token as string;

    // 访问受保护的测试路由
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(authRes.body.user.id);
  });

  it('不带 Authorization 头返回 401', async () => {
    const app = await buildTestApp();

    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  it('带无效 token 返回 401', async () => {
    const app = await buildTestApp();

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer 无效token');

    expect(res.status).toBe(401);
  });
});
