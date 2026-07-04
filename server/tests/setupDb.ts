// DB 测试生命周期：仅在需要 Postgres 的测试文件里显式 import。
// 例如：tests/db.test.ts 顶部加上 `import './setupDb.js';`
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
