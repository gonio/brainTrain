// 启动入口：初始化 schema + 启动 server
import { buildApp } from './app.js';
import { initSchema, pool } from './db.js';
import { config } from './config.js';

async function main(): Promise<void> {
  await initSchema();

  const { httpServer } = buildApp();

  httpServer.listen(config.port, () => {
    console.log(`[server] 多人对战后端已启动，端口 ${config.port}`);
  });
}

main().catch(async (err) => {
  console.error('[server] 启动失败:', err);
  await pool.end();
  process.exit(1);
});
