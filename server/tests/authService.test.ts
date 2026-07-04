import { describe, it, expect } from 'vitest';
import {
  generateUsername,
  generateAvatar,
  generateToken,
} from '../src/auth/authService.js';

describe('authService 纯逻辑', () => {
  describe('generateUsername', () => {
    it('生成「形容词+动物+#4位」格式的昵称', () => {
      const name = generateUsername();
      // 形如「迅捷猎豹#3F7K」：中文形容词+中文动物+#4位大写字母数字（去易混字符）
      expect(name).toMatch(/^[\u4e00-\u9fa5]+#[A-Z0-9]{4}$/);
    });

    it('每次调用结果不同（随机）', () => {
      const names = new Set(Array.from({ length: 20 }, () => generateUsername()));
      expect(names.size).toBeGreaterThan(1);
    });
  });

  describe('generateAvatar', () => {
    it('返回一个 emoji 字符', () => {
      const avatar = generateAvatar();
      // emoji 是非空字符串，长度 1-8（有些 emoji 多码元）
      expect(avatar.length).toBeGreaterThan(0);
      expect(avatar.length).toBeLessThanOrEqual(8);
    });

    it('每次调用从池子里随机', () => {
      const avatars = new Set(Array.from({ length: 30 }, () => generateAvatar()));
      expect(avatars.size).toBeGreaterThan(1);
    });
  });

  describe('generateToken', () => {
    it('返回 UUID 格式的字符串', () => {
      const token = generateToken();
      expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('每次调用结果不同', () => {
      const a = generateToken();
      const b = generateToken();
      expect(a).not.toBe(b);
    });
  });
});
