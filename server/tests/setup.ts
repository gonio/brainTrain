// 测试 setup：设置 NODE_ENV，每条测试前清表
process.env.NODE_ENV = 'test';

import { afterAll, beforeAll, beforeEach } from 'vitest';
import { pool, initSchema, clearTables } from '../src/db.js';

beforeAll(async () => {
  await initSchema();
});

beforeEach(async () => {
  await clearTables();
});

afterAll(async () => {
  await pool.end();
});
