// 匿名账号纯逻辑：生成昵称、头像、token。无 IO，纯函数，便于单测。
import { randomUUID } from 'node:crypto';
import { createUser } from './authRepository.js';
import type { User } from '../types.js';

// 形容词池（中文）
const ADJECTIVES = [
  '迅捷', '机敏', '专注', '冷静', '机灵', '沉稳', '锐利', '灵动',
  '睿智', '敏锐', '果敢', '沉着',
];

// 动物池（中文）
const ANIMALS = [
  '猎豹', '狐狸', '猫头鹰', '海豚', '松鼠', '兔子', '苍鹰', '银狐',
  '麋鹿', '雪狼', '锦鲤', '蜂鸟',
];

// 头像 emoji 池
const AVATARS = [
  '🦊', '🦉', '🐬', '🐱', '🐰', '🦅', '🐺', '🦌',
  '🐟', '🐦', '🐧', '🦢', '🐯', '🦁', '🐨', '🐵',
];

// 码表：去掉易混字符 0/O/1/I/L
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomCode(length = 4): string {
  return Array.from(
    { length },
    () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join('');
}

// 生成随机昵称，形如「迅捷猎豹#3F7K」
export function generateUsername(): string {
  return `${randomFrom(ADJECTIVES)}${randomFrom(ANIMALS)}#${randomCode()}`;
}

// 生成随机 emoji 头像
export function generateAvatar(): string {
  return randomFrom(AVATARS);
}

// 生成随机 token（UUID v4）
export function generateToken(): string {
  return randomUUID();
}

// 建匿名用户：如果提供了 preferredUsername 且不冲突就用，否则随机生成；冲突则重试。
export async function createAnonymousUser(opts?: { preferredUsername?: string; preferredAvatar?: string }): Promise<User> {
  const avatar = opts?.preferredAvatar || generateAvatar();
  const token = generateToken();

  // 优先用 preferred 用户名
  if (opts?.preferredUsername) {
    try {
      return await createUser({ username: opts.preferredUsername, avatar, token });
    } catch {
      // preferred 冲突，落到随机
    }
  }

  // 随机生成，冲突重试最多 5 次
  for (let i = 0; i < 5; i++) {
    try {
      return await createUser({ username: generateUsername(), avatar, token });
    } catch (e) {
      // 23505 = unique_violation，重试；其他错误抛出
      if ((e as { code?: string }).code !== '23505') throw e;
    }
  }
  throw new Error('生成唯一用户名失败，请重试');
}
