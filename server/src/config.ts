// 配置：从环境变量读取，提供类型安全的配置对象
import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`缺少环境变量: ${name}`);
  }
  return value;
}

export const config = {
  databaseUrl: required('DATABASE_URL'),
  testDatabaseUrl: process.env.TEST_DATABASE_URL ?? required('DATABASE_URL'),
  port: parseInt(process.env.PORT ?? '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  isTest: process.env.NODE_ENV === 'test',
} as const;
