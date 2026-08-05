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

  it('带 preferredUsername 时使用该用户名', async () => {
    const app = await buildTestApp();

    const res = await request(app)
      .post('/api/auth/anonymous')
      .send({ preferredUsername: '我的昵称', preferredAvatar: '🐲' });

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('我的昵称');
    expect(res.body.user.avatar).toBe('🐲');
  });

  it('preferredUsername 冲突时回退到随机用户名', async () => {
    const app = await buildTestApp();

    // 先占用一个用户名
    const first = await request(app)
      .post('/api/auth/anonymous')
      .send({ preferredUsername: '重复名' });
    expect(first.body.user.username).toBe('重复名');

    // 再用同样的 preferredUsername，应回退随机
    const res = await request(app)
      .post('/api/auth/anonymous')
      .send({ preferredUsername: '重复名' });

    expect(res.status).toBe(200);
    expect(res.body.user.username).not.toBe('重复名');
    expect(res.body.user.username).toBeTruthy();
  });
});

describe('PUT /api/auth/me', () => {
  it('更新 username 成功', async () => {
    const app = await buildTestApp();

    // 先建号拿 token
    const authRes = await request(app).post('/api/auth/anonymous');
    const token = authRes.body.token as string;

    const res = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: '新昵称' });

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('新昵称');
  });

  it('更新 avatar 成功', async () => {
    const app = await buildTestApp();

    const authRes = await request(app).post('/api/auth/anonymous');
    const token = authRes.body.token as string;

    const res = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ avatar: '🦄' });

    expect(res.status).toBe(200);
    expect(res.body.user.avatar).toBe('🦄');
  });

  it('重复 username 返回 409', async () => {
    const app = await buildTestApp();

    // 用户 A 占用「占用名」
    const a = await request(app)
      .post('/api/auth/anonymous')
      .send({ preferredUsername: '占用名' });
    const tokenA = a.body.token as string;

    // 用户 B 先建号
    const b = await request(app).post('/api/auth/anonymous');
    const tokenB = b.body.token as string;

    // B 试图改成「占用名」
    const res = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ username: '占用名' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBeTruthy();
  });

  it('无效 username（空串）返回 400', async () => {
    const app = await buildTestApp();

    const authRes = await request(app).post('/api/auth/anonymous');
    const token = authRes.body.token as string;

    const res = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: '   ' });

    expect(res.status).toBe(400);
  });

  it('无效 username（超长）返回 400', async () => {
    const app = await buildTestApp();

    const authRes = await request(app).post('/api/auth/anonymous');
    const token = authRes.body.token as string;

    const res = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'a'.repeat(21) });

    expect(res.status).toBe(400);
  });

  it('未带 token 返回 401', async () => {
    const app = await buildTestApp();

    const res = await request(app)
      .put('/api/auth/me')
      .send({ username: '新昵称' });

    expect(res.status).toBe(401);
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
      // 注意：HTTP header 不允许非 ASCII 字符，用 ASCII 字符串模拟无效 token
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
  });
});
