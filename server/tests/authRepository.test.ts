import { describe, it, expect } from 'vitest';
import { createUser, findUserByToken } from '../src/auth/authRepository.js';
import { generateUsername, generateAvatar, generateToken } from '../src/auth/authService.js';

// 需要 DB 生命周期（建表 + 每条测试前清表）
import './setupDb.js';

describe('authRepository', () => {
  it('createUser 写入并返回 user（带 id 和 createdAt）', async () => {
    const username = generateUsername();
    const avatar = generateAvatar();
    const token = generateToken();

    const user = await createUser({ username, avatar, token });

    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.username).toBe(username);
    expect(user.avatar).toBe(avatar);
    expect(user.token).toBe(token);
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it('createUser 后 findUserByToken 能查到', async () => {
    const token = generateToken();
    const created = await createUser({
      username: generateUsername(),
      avatar: generateAvatar(),
      token,
    });

    const found = await findUserByToken(token);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
    expect(found?.username).toBe(created.username);
  });

  it('findUserByToken 查不到返回 null', async () => {
    const found = await findUserByToken('不存在的token');
    expect(found).toBeNull();
  });

  it('token 唯一约束：重复 token 抛错', async () => {
    const token = generateToken();
    await createUser({
      username: generateUsername(),
      avatar: generateAvatar(),
      token,
    });

    await expect(
      createUser({
        username: generateUsername(),
        avatar: generateAvatar(),
        token,
      })
    ).rejects.toThrow();
  });
});
