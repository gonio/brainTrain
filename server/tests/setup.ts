// 全局测试 setup：仅设置环境变量，不依赖数据库。
// 纯逻辑测试（如 authService）无需 Postgres 即可运行。
// 需要 DB 生命周期的测试文件应显式 import './setupDb.js'。
process.env.NODE_ENV = 'test';
