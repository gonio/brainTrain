// 数据库连接池 + schema 初始化
import pg, { type Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 测试环境用测试库，否则用正式库
const connectionString = config.isTest ? config.testDatabaseUrl : config.databaseUrl;

export const pool: Pool = new pg.Pool({ connectionString });

// 初始化 schema（建表）。应用启动时调用一次。
export async function initSchema(): Promise<void> {
  const schemaSql = readFileSync(resolve(__dirname, '../schema.sql'), 'utf-8');
  await pool.query(schemaSql);
}

// 测试用：清空所有表（每个 test 前调用）
export async function clearTables(): Promise<void> {
  await pool.query('TRUNCATE TABLE matches CASCADE');
  await pool.query('TRUNCATE TABLE users CASCADE');
}
