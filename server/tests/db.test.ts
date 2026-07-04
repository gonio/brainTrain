import { describe, it, expect } from 'vitest';
import { pool } from '../src/db.js';

describe('数据库连接', () => {
  it('能连上 Postgres 并执行简单查询', async () => {
    const result = await pool.query('SELECT 1 + 1 AS sum');
    expect(result.rows[0].sum).toBe(2);
  });

  it('users 表存在', async () => {
    const result = await pool.query(
      "SELECT to_regclass('public.users') AS exists"
    );
    expect(result.rows[0].exists).toBe('users');
  });
});
