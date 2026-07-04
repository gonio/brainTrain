import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // DB 集成测试共享同一个连接池和测试库，必须串行跑：
    // 否则多文件并发的 beforeEach(clearTables) 会互相清掉对方刚插入的数据。
    // 单 fork 串行执行所有测试文件，避免污染。
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
