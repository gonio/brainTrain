// 用户数据访问层：封装 users 表的增查
import { pool } from '../db.js';
import type { User } from '../types.js';

interface CreateUserInput {
  username: string;
  avatar: string;
  token: string;
}

// 把数据库行映射成 User 类型（日期转 Date）
function mapRow(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    username: row.username as string,
    avatar: row.avatar as string,
    token: row.token as string,
    createdAt: new Date(row.created_at as string),
  };
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const result = await pool.query(
    `INSERT INTO users (username, avatar, token)
     VALUES ($1, $2, $3)
     RETURNING id, username, avatar, token, created_at`,
    [input.username, input.avatar, input.token]
  );
  return mapRow(result.rows[0]);
}

export async function findUserByToken(token: string): Promise<User | null> {
  const result = await pool.query(
    `SELECT id, username, avatar, token, created_at
     FROM users WHERE token = $1`,
    [token]
  );
  if (result.rows.length === 0) return null;
  return mapRow(result.rows[0]);
}
