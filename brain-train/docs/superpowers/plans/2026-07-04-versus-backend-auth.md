# 多人对战 - 计划一：后端骨架 + 匿名账号 + Postgres

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭起多人对战的后端骨架：Node + Express + Socket.IO + Postgres，实现匿名账号系统（建号/发 token/校验），让前端能建号、带 token 调 REST、Socket.IO 连接通过鉴权。本计划交付可独立运行测试的后端，不含房间/对战/排行榜逻辑（后续计划）。

**Architecture:** 后端是独立进程（与前端 SPA 分离），新增顶层 `server/` 目录（与 `brain-train/` 同级）。Express 提供 REST（`/api/auth/*`），Socket.IO 复用同一 HTTP server 并通过 `io.use()` 中间件校验 token。Postgres 装 `users` 表。Auth 模块是纯函数 + DB 访问层，便于单测。

**Tech Stack:** Node.js 20+, TypeScript, Express 4, Socket.IO 4, Postgres（`pg` 驱动）, Vitest, supertest。前端新增 `socket.io-client`。

**Spec:** `brain-train/docs/superpowers/specs/2026-07-04-multiplayer-versus-design.md`（第 2、3、7 章）

---

## 关于多计划分解

完整多人对战按 spec 第 10 章分 5 步交付，本计划是**第 1 步**。后续计划：

- 计划二：Room Engine + 大厅 + 匹配（spec 第 4 章）
- 计划三：舒尔特 PvP（spec 第 5 章）
- 计划四：战绩 + 排行榜（spec 第 6 章）
- 计划五：前端大厅 + 对战页 + 排行榜页 UI 串联（spec 第 8 章）

每个计划独立可测。本计划完成后，后端能跑、能建号、能鉴权，但还玩不了对战。

---

## 文件结构总览

### 新增后端文件（`server/`）

| 文件 | 职责 |
|---|---|
| `server/package.json` | 后端依赖与脚本（独立于前端） |
| `server/tsconfig.json` | TS 配置（Node ES2022 + nodenext） |
| `server/vitest.config.ts` | 测试配置 |
| `server/.env.example` | 环境变量模板（DB 连接、端口、CORS） |
| `server/src/config.ts` | 读 env、导出配置常量 |
| `server/src/db.ts` | Postgres 连接池（`pg.Pool`）+ schema 初始化 |
| `server/src/schema.sql` | 建表 SQL（users 表） |
| `server/src/types.ts` | 共享类型：`User`、`AuthResult`、`SocketAuthPayload` |
| `server/src/auth/authService.ts` | 纯逻辑：生成随机用户名、随机 emoji、生成 token（crypto.randomUUID） |
| `server/src/auth/authRepository.ts` | DB 访问：createUser、findUserByToken |
| `server/src/auth/authRoutes.ts` | Express 路由：`POST /api/auth/anonymous` |
| `server/src/auth/authMiddleware.ts` | Express 中间件：从 Authorization 头取 token、查 user、挂 `req.user` |
| `server/src/realtime/socketAuth.ts` | Socket.IO 中间件：从 `socket.handshake.auth` 取 token 校验 |
| `server/src/app.ts` | 组装 Express app + Socket.IO server（HTTP server 共享） |
| `server/src/index.ts` | 启动入口：listen + 初始化 |
| `server/tests/setup.ts` | 测试 setup：连测试 DB、清表 |
| `server/tests/authService.test.ts` | 纯逻辑单测 |
| `server/tests/authRoutes.test.ts` | 集成测试（supertest） |
| `server/tests/socketAuth.test.ts` | Socket.IO 鉴权集成测试 |

### 改动前端文件

| 文件 | 改动 |
|---|---|
| `brain-train/package.json` | 加 `socket.io-client` 依赖 |
| `brain-train/src/types/versus.ts` | 新增：共享类型（`User`、`AuthResult`） |
| `brain-train/src/db/index.ts` | Dexie 加 `versusAuth` 表（存 token） |
| `brain-train/src/stores/authStore.ts` | 新增：Zustand store，管 token/user 状态，自动建号 |
| `brain-train/src/lib/versusApi.ts` | 新增：REST 客户端（fetch 封装，带 token 头） |
| `brain-train/src/lib/versusSocket.ts` | 新增：Socket.IO 连接管理（带 token 鉴权） |

---

## 任务依赖图

```
Task 1 (server 骨架) → Task 2 (config + DB) → Task 3 (schema + db.ts) ─┐
                                                                         │
Task 4 (authService 纯逻辑) [TDD] ──────────────────────────────────────┐│
Task 5 (authRepository) ────────────────────────────────────────────────┤│
Task 6 (authRoutes + authMiddleware) ───────────────────────────────────┤│
Task 7 (Socket.IO 鉴权) ────────────────────────────────────────────────┤│
Task 8 (app.ts 组装 + index.ts 启动) ───────────────────────────────────┘│
                                                                          │
Task 9 (前端类型 + Dexie token 表) ──────────────────────────────────────┤
Task 10 (前端 authStore + versusApi) ────────────────────────────────────┤
Task 11 (前端 versusSocket 连接) ────────────────────────────────────────┘
Task 12 (端到端冒烟：前端建号 → 连 socket)
```

---

## Task 1: 搭建 server 项目骨架

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/.env.example`
- Create: `server/.gitignore`
- Modify: `D:\BrainTrain\.gitignore`

- [ ] **Step 1: 创建 server/package.json**

```json
{
  "name": "braintrain-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "pg": "^8.12.0",
    "socket.io": "^4.7.5"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.14.0",
    "@types/pg": "^8.11.6",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0",
    "tsx": "^4.15.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: 创建 server/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: 创建 server/.env.example**

```env
# Postgres 连接（本机）
DATABASE_URL=postgresql://braintrain:braintrain@localhost:5432/braintrain

# 测试用 DB（单独库，避免污染开发数据）
TEST_DATABASE_URL=postgresql://braintrain:braintrain@localhost:5432/braintrain_test

# 服务端口（Nginx 反代到此）
PORT=3001

# 前端 origin（CORS + Socket.IO）
CORS_ORIGIN=http://localhost:5173
```

- [ ] **Step 4: 创建 server/.gitignore**

```
node_modules/
dist/
.env
*.log
```

- [ ] **Step 5: 在仓库根 .gitignore 补一行忽略 server 的产物**

在 `D:\BrainTrain\.gitignore` 末尾追加：

```
# 后端 server（多人对战）
server/node_modules/
server/dist/
server/.env
```

- [ ] **Step 6: 安装依赖**

Run: `cd D:\BrainTrain\server && npm install`
Expected: node_modules 生成，无错误。

- [ ] **Step 7: Commit**

```bash
cd D:\BrainTrain
git add server/package.json server/tsconfig.json server/.env.example server/.gitignore .gitignore
git commit -m "feat(server): 搭建多人对战后端项目骨架"
```

---

## Task 2: 配置模块 config.ts

**Files:**
- Create: `server/src/config.ts`
- Create: `server/vitest.config.ts`
- Create: `server/tests/setup.ts`

- [ ] **Step 1: 创建 server/src/config.ts**

```typescript
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
```

- [ ] **Step 2: 创建 server/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
  },
});
```

- [ ] **Step 3: 创建 server/tests/setup.ts（占位，Task 3 补 DB 连接）**

```typescript
// 测试 setup：设置 NODE_ENV，具体 DB 清理在 Task 3 补
process.env.NODE_ENV = 'test';
```

- [ ] **Step 4: Commit**

```bash
git add server/src/config.ts server/vitest.config.ts server/tests/setup.ts
git commit -m "feat(server): 配置模块 + vitest 配置"
```

---

## Task 3: Postgres 连接池 + schema 初始化

**Files:**
- Create: `server/src/schema.sql`
- Create: `server/src/db.ts`
- Modify: `server/tests/setup.ts`

- [ ] **Step 1: 创建 server/src/schema.sql（users 表）**

```sql
-- 多人对战 schema
-- 注意：matches / user_stats 表在计划四加，本计划只建 users

CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username    TEXT NOT NULL,
  avatar      TEXT NOT NULL,
  token       TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_token ON users(token);
```

- [ ] **Step 2: 创建 server/src/db.ts**

```typescript
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
  await pool.query('TRUNCATE TABLE users CASCADE');
}
```

- [ ] **Step 3: 更新 server/tests/setup.ts，加全局 beforeEach 清表**

```typescript
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
```

- [ ] **Step 4: 写一个 smoke 测试验证 DB 连接**

Create `server/tests/db.test.ts`:

```typescript
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
```

- [ ] **Step 5: 跑测试验证（需要本机 Postgres 运行）**

Run: `cd D:\BrainTrain\server && npm test`
Expected: db.test.ts 2 个用例通过。

> **注：** 若本机未装 Postgres，此步会失败。可先跳过，在 Task 8 启动验证时一起测。但代码先写好。

- [ ] **Step 6: Commit**

```bash
git add server/src/schema.sql server/src/db.ts server/tests/setup.ts server/tests/db.test.ts
git commit -m "feat(server): Postgres 连接池 + users 表 schema"
```

---

## Task 4: authService 纯逻辑（TDD）

**Files:**
- Test: `server/tests/authService.test.ts`
- Create: `server/src/auth/authService.ts`
- Create: `server/src/types.ts`

- [ ] **Step 1: 先写 server/src/types.ts（共享类型）**

```typescript
// 多人对战共享类型

// 用户实体（数据库行映射）
export interface User {
  id: string;
  username: string;
  avatar: string;
  token: string;
  createdAt: Date;
}

// POST /api/auth/anonymous 的响应
export interface AuthResult {
  user: User;
  token: string;
}

// Socket.IO 连接鉴权载荷（客户端在 handshake.auth 里带）
export interface SocketAuthPayload {
  token: string;
}
```

- [ ] **Step 2: 写失败的测试 server/tests/authService.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import {
  generateUsername,
  generateAvatar,
  generateToken,
} from '../src/auth/authService.js';

describe('authService 纯逻辑', () => {
  describe('generateUsername', () => {
    it('生成「形容词+动物+#4位」格式的昵称', () => {
      const name = generateUsername();
      // 形如「迅捷猎豹#3F7K」
      expect(name).toMatch(/^.+ .+#.+$/);
      expect(name).toMatch(/^[^\s]+ [^\s]+#[A-Z0-9]{4}$/);
    });

    it('每次调用结果不同（随机）', () => {
      const names = new Set(Array.from({ length: 20 }, () => generateUsername()));
      expect(names.size).toBeGreaterThan(1);
    });
  });

  describe('generateAvatar', () => {
    it('返回一个 emoji 字符', () => {
      const avatar = generateAvatar();
      // emoji 是非空字符串，长度 1-8（有些 emoji 多码元）
      expect(avatar.length).toBeGreaterThan(0);
      expect(avatar.length).toBeLessThanOrEqual(8);
    });

    it('每次调用从池子里随机', () => {
      const avatars = new Set(Array.from({ length: 30 }, () => generateAvatar()));
      expect(avatars.size).toBeGreaterThan(1);
    });
  });

  describe('generateToken', () => {
    it('返回 UUID 格式的字符串', () => {
      const token = generateToken();
      expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('每次调用结果不同', () => {
      const a = generateToken();
      const b = generateToken();
      expect(a).not.toBe(b);
    });
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `cd D:\BrainTrain\server && npx vitest run tests/authService.test.ts`
Expected: FAIL，报模块找不到（`Cannot find module '../src/auth/authService.js'`）。

- [ ] **Step 4: 实现 server/src/auth/authService.ts**

```typescript
// 匿名账号纯逻辑：生成昵称、头像、token。无 IO，纯函数，便于单测。
import { randomUUID } from 'node:crypto';

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
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd D:\BrainTrain\server && npx vitest run tests/authService.test.ts`
Expected: PASS，全部用例通过。

- [ ] **Step 6: Commit**

```bash
git add server/src/types.ts server/src/auth/authService.ts server/tests/authService.test.ts
git commit -m "feat(server): authService 纯逻辑（昵称/头像/token 生成）"
```

---

## Task 5: authRepository（DB 访问层）

**Files:**
- Create: `server/src/auth/authRepository.ts`
- Test: `server/tests/authRepository.test.ts`

- [ ] **Step 1: 写失败的测试 server/tests/authRepository.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { createUser, findUserByToken } from '../src/auth/authRepository.js';
import { pool } from '../src/db.js';
import { generateUsername, generateAvatar, generateToken } from '../src/auth/authService.js';

describe('authRepository', () => {
  it('createUser 写入并返回 user（带 id 和 createdAt）', async () => {
    const username = generateUsername();
    const avatar = generateAvatar();
    const token = generateToken();

    const user = await createUser({ username, avatar, token });

    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.username).toBe(username);
    expect(user.avatar).toBe(avatar);
    expect(user.token).toBe(token);
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it('createUser 后 findUserByToken 能查到', async () => {
    const token = generateToken();
    const created = await createUser({
      username: generateUsername(),
      avatar: generateAvatar(),
      token,
    });

    const found = await findUserByToken(token);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
    expect(found?.username).toBe(created.username);
  });

  it('findUserByToken 查不到返回 null', async () => {
    const found = await findUserByToken('不存在的token');
    expect(found).toBeNull();
  });

  it('token 唯一约束：重复 token 抛错', async () => {
    const token = generateToken();
    await createUser({
      username: generateUsername(),
      avatar: generateAvatar(),
      token,
    });

    await expect(
      createUser({
        username: generateUsername(),
        avatar: generateAvatar(),
        token,
      })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd D:\BrainTrain\server && npx vitest run tests/authRepository.test.ts`
Expected: FAIL，模块找不到。

- [ ] **Step 3: 实现 server/src/auth/authRepository.ts**

```typescript
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd D:\BrainTrain\server && npx vitest run tests/authRepository.test.ts`
Expected: PASS，4 个用例通过。

- [ ] **Step 5: Commit**

```bash
git add server/src/auth/authRepository.ts server/tests/authRepository.test.ts
git commit -m "feat(server): authRepository 用户增查 + token 唯一约束"
```

---

## Task 6: authRoutes + authMiddleware

**Files:**
- Create: `server/src/auth/authRoutes.ts`
- Create: `server/src/auth/authMiddleware.ts`
- Test: `server/tests/authRoutes.test.ts`

- [ ] **Step 1: 写失败的测试 server/tests/authRoutes.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildTestApp } from './helpers.js';

describe('POST /api/auth/anonymous', () => {
  it('返回 200 + user + token', async () => {
    const app = await buildTestApp();

    const res = await request(app).post('/api/auth/anonymous');

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.user.username).toBeTruthy();
    expect(res.body.user.avatar).toBeTruthy();
    expect(res.body.token).toBe(res.body.user.token);
    expect(typeof res.body.token).toBe('string');
  });

  it('每次调用创建不同用户', async () => {
    const app = await buildTestApp();

    const res1 = await request(app).post('/api/auth/anonymous');
    const res2 = await request(app).post('/api/auth/anonymous');

    expect(res1.body.user.id).not.toBe(res2.body.user.id);
    expect(res1.body.token).not.toBe(res2.body.token);
  });
});

describe('authMiddleware（Bearer token 校验）', () => {
  it('带有效 token 访问受保护路由返回 200', async () => {
    const app = await buildTestApp();

    // 先建号拿 token
    const authRes = await request(app).post('/api/auth/anonymous');
    const token = authRes.body.token as string;

    // 访问受保护的测试路由
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(authRes.body.user.id);
  });

  it('不带 Authorization 头返回 401', async () => {
    const app = await buildTestApp();

    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  it('带无效 token 返回 401', async () => {
    const app = await buildTestApp();

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer 无效token');

    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 写测试 helper server/tests/helpers.ts**

```typescript
// 测试用：组装一个独立的 Express app（不启动 server 监听）
import express, { type Express } from 'express';
import cors from 'cors';
import { config } from '../src/config.js';
import { authRouter } from '../src/auth/authRoutes.js';

export async function buildTestApp(): Promise<Express> {
  const app = express();
  app.use(express.json());
  app.use(cors({ origin: config.corsOrigin }));
  app.use('/api/auth', authRouter);
  return app;
}
```

- [ ] **Step 3: 跑测试确认失败**

Run: `cd D:\BrainTrain\server && npx vitest run tests/authRoutes.test.ts`
Expected: FAIL，模块找不到。

- [ ] **Step 4: 实现 server/src/auth/authMiddleware.ts**

```typescript
// Express 中间件：从 Authorization: Bearer <token> 取 token，查 user，挂到 req.user
import type { Request, Response, NextFunction } from 'express';
import { findUserByToken } from './authRepository.js';
import type { User } from '../types.js';

// 扩展 Express Request 类型，加 user 字段
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// 从 Authorization 头解析 Bearer token
function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  return match ? match[1] : null;
}

// 受保护路由用：要求有效 token
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: '未提供 token' });
    return;
  }

  const user = await findUserByToken(token);
  if (!user) {
    res.status(401).json({ error: 'token 无效' });
    return;
  }

  req.user = user;
  next();
}
```

- [ ] **Step 5: 实现 server/src/auth/authRoutes.ts**

```typescript
// Auth 路由：POST /api/auth/anonymous（建匿名号）、GET /api/auth/me（查当前用户）
import { Router } from 'express';
import { generateUsername, generateAvatar, generateToken } from './authService.js';
import { createUser } from './authRepository.js';
import { requireAuth } from './authMiddleware.js';
import type { AuthResult } from '../types.js';

export const authRouter = Router();

// 建匿名账号
authRouter.post('/anonymous', async (req, res) => {
  const user = await createUser({
    username: generateUsername(),
    avatar: generateAvatar(),
    token: generateToken(),
  });

  const result: AuthResult = { user, token: user.token };
  res.json(result);
});

// 查当前用户（受保护）
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
```

- [ ] **Step 6: 跑测试确认通过**

Run: `cd D:\BrainTrain\server && npx vitest run tests/authRoutes.test.ts`
Expected: PASS，5 个用例通过。

- [ ] **Step 7: Commit**

```bash
git add server/src/auth/authRoutes.ts server/src/auth/authMiddleware.ts server/tests/authRoutes.test.ts server/tests/helpers.ts
git commit -m "feat(server): auth 路由 + Bearer token 鉴权中间件"
```

---

## Task 7: Socket.IO 鉴权中间件

**Files:**
- Create: `server/src/realtime/socketAuth.ts`
- Test: `server/tests/socketAuth.test.ts`

- [ ] **Step 1: 写失败的测试 server/tests/socketAuth.test.ts**

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { attachAuthMiddleware } from '../src/realtime/socketAuth.js';
import { authRouter } from '../src/auth/authRoutes.js';
import express from 'express';

// 建一个真实监听的测试 server，供 socket.io-client 连
async function startTestServer(): Promise<{ httpServer: HttpServer; port: number; close: () => Promise<void> }> {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);

  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, { cors: { origin: '*' } });
  attachAuthMiddleware(io);

  return new Promise((resolveP) => {
    httpServer.listen(0, () => {
      const port = (httpServer.address() as { port: number }).port;
      resolveP({
        httpServer,
        port,
        close: () => new Promise<void>((res) => {
          io.close();
          httpServer.close(() => res());
        }),
      });
    });
  });
}

function clientConnect(port: number, auth?: object): Promise<ClientSocket> {
  return new Promise((resolveP, reject) => {
    const sock = ioc(`http://localhost:${port}`, auth ? { auth } : {});
    sock.on('connect', () => resolveP(sock));
    sock.on('connect_error', (err) => reject(err));
  });
}

describe('Socket.IO 鉴权', () => {
  let cleanup: (() => Promise<void>) | null = null;

  afterEach(async () => {
    if (cleanup) await cleanup();
    cleanup = null;
  });

  it('不带 token 连接被拒（connect_error）', async () => {
    const server = await startTestServer();
    cleanup = server.close;

    await expect(clientConnect(server.port)).rejects.toThrow();

    // 注意：不带 token 应在 connect_error 里收到 401 信息
  });

  it('带无效 token 连接被拒', async () => {
    const server = await startTestServer();
    cleanup = server.close;

    await expect(clientConnect(server.port, { token: '无效token' })).rejects.toThrow();
  });

  it('带有效 token 连接成功', async () => {
    const server = await startTestServer();
    cleanup = server.close;

    // 先建号拿 token（用 fetch 调 REST）
    const authRes = await fetch(`http://localhost:${server.port}/api/auth/anonymous`, {
      method: 'POST',
    });
    const { token } = await authRes.json() as { token: string };

    // 带有效 token 连 socket
    const sock = await clientConnect(server.port, { token });
    expect(sock.connected).toBe(true);
    sock.disconnect();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd D:\BrainTrain\server && npx vitest run tests/socketAuth.test.ts`
Expected: FAIL，模块找不到。

> **注：** 此测试需要 `socket.io-client` 作为 devDependency。已在 Task 1 的 package.json 里。如果跑前没装，先 `npm install`。

- [ ] **Step 3: 实现 server/src/realtime/socketAuth.ts**

```typescript
// Socket.IO 鉴权中间件：连接时校验 handshake.auth.token
import type { Server as SocketIOServer, Socket } from 'socket.io';
import { findUserByToken } from '../auth/authRepository.js';

// 给 Socket 实例扩展 userId 字段
declare module 'socket.io' {
  interface Socket {
    userId?: string;
    userName?: string;
  }
}

export function attachAuthMiddleware(io: SocketIOServer): void {
  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error('未提供 token'));
      return;
    }

    const user = await findUserByToken(token);
    if (!user) {
      next(new Error('token 无效'));
      return;
    }

    // 把用户信息挂到 socket 上，后续房间/对战逻辑用
    socket.userId = user.id;
    socket.userName = user.username;
    next();
  });
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd D:\BrainTrain\server && npx vitest run tests/socketAuth.test.ts`
Expected: PASS，3 个用例通过。

- [ ] **Step 5: Commit**

```bash
git add server/src/realtime/socketAuth.ts server/tests/socketAuth.test.ts
git commit -m "feat(server): Socket.IO 连接鉴权中间件"
```

---

## Task 8: app.ts 组装 + index.ts 启动入口

**Files:**
- Create: `server/src/app.ts`
- Create: `server/src/index.ts`

- [ ] **Step 1: 实现 server/src/app.ts**

```typescript
// 组装 Express app + Socket.IO server，共享一个 HTTP server
import express, { type Express } from 'express';
import cors from 'cors';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config.js';
import { authRouter } from './auth/authRoutes.js';
import { attachAuthMiddleware } from './realtime/socketAuth.js';

export interface AppBundle {
  app: Express;
  httpServer: HttpServer;
  io: SocketIOServer;
}

// 组装 app（不监听端口，测试和启动复用）
export function buildApp(): AppBundle {
  const app = express();
  app.use(express.json());
  app.use(cors({ origin: config.corsOrigin }));

  // 健康检查
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Auth 路由
  app.use('/api/auth', authRouter);

  // HTTP server + Socket.IO（共享）
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: config.corsOrigin },
  });
  attachAuthMiddleware(io);

  return { app, httpServer, io };
}
```

- [ ] **Step 2: 实现 server/src/index.ts（启动入口）**

```typescript
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
```

- [ ] **Step 3: 加一个 buildApp 的 smoke 测试到 server/tests/app.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';

describe('app 组装', () => {
  it('GET /api/health 返回 ok', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
```

- [ ] **Step 4: 跑全部测试**

Run: `cd D:\BrainTrain\server && npm test`
Expected: 全部用例通过（authService、authRepository、authRoutes、socketAuth、db、app）。

> **注：** 需要 Postgres 运行。本机用：`docker run -d --name bt-pg -e POSTGRES_USER=braintrain -e POSTGRES_PASSWORD=braintrain -e POSTGRES_DB=braintrain -p 5432:5432 postgres:16`，并额外建测试库 `createdb -h localhost -U braintrain braintrain_test`。

- [ ] **Step 5: 验证 dev 启动（手动）**

Run: `cd D:\BrainTrain\server && cp .env.example .env && npm run dev`
Expected: 控制台打印 `[server] 多人对战后端已启动，端口 3001`。

手动测：
```bash
curl -X POST http://localhost:3001/api/auth/anonymous
# 应返回 { user: {...}, token: "..." }

curl http://localhost:3001/api/health
# 应返回 { status: "ok" }
```

- [ ] **Step 6: Commit**

```bash
git add server/src/app.ts server/src/index.ts server/tests/app.test.ts
git commit -m "feat(server): app 组装 + 启动入口 + 健康检查"
```

---

## Task 9: 前端共享类型 + Dexie token 表

**Files:**
- Modify: `brain-train/package.json`（加 socket.io-client）
- Create: `brain-train/src/types/versus.ts`
- Modify: `brain-train/src/db/index.ts`

- [ ] **Step 1: 前端加 socket.io-client 依赖**

Run: `cd D:\BrainTrain\brain-train && npm install socket.io-client`

- [ ] **Step 2: 创建 brain-train/src/types/versus.ts**

```typescript
// 多人对战共享类型（与后端 server/src/types.ts 对应）

// 用户实体
export interface VersusUser {
  id: string;
  username: string;
  avatar: string;
  token: string;
  createdAt: string; // 后端 ISO 字符串
}

// POST /api/auth/anonymous 响应
export interface AuthResult {
  user: VersusUser;
  token: string;
}
```

- [ ] **Step 3: 修改 brain-train/src/db/index.ts，加 versusAuth 表**

先读现有文件确认当前 schema 版本和结构：

Run: `cat D:\BrainTrain\brain-train\src\db\index.ts`

在现有 Dexie schema 里加一张表（存多人对战 token，单行记录）。假设当前是 v4，bump 到 v5：

```typescript
// 在现有 stores 定义后追加（示例，实际要看现有代码结构）：
// v5: 新增 versusAuth 表
db.version(5).stores({
  versusAuth: 'id', // 单行记录，id 固定为 'current'
});
```

> **注意：** 具体改法要看现有 db/index.ts 的 version 链结构。实现时先 Read 该文件，按现有模式追加 version(5)，不要改历史 version。

- [ ] **Step 4: Commit**

```bash
cd D:\BrainTrain
git add brain-train/package.json brain-train/package-lock.json brain-train/src/types/versus.ts brain-train/src/db/index.ts
git commit -m "feat(versus): 前端共享类型 + Dexie token 表 + socket.io-client"
```

---

## Task 10: 前端 authStore + versusApi

**Files:**
- Create: `brain-train/src/lib/versusApi.ts`
- Create: `brain-train/src/stores/authStore.ts`
- Test: `brain-train/tests/unit/authStore.test.ts`

- [ ] **Step 1: 写失败的测试 brain-train/tests/unit/authStore.test.ts**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../../src/stores/authStore';
import { versusApi } from '../../src/lib/versusApi';

// mock versusApi
vi.mock('../../src/lib/versusApi', () => ({
  versusApi: {
    createAnonymous: vi.fn(),
  },
}));

beforeEach(() => {
  useAuthStore.getState().reset();
  vi.clearAllMocks();
});

describe('authStore', () => {
  it('初始状态：未登录、无 token、无 user', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated()).toBe(false);
  });

  it('ensureAuthenticated 无 token 时自动建号', async () => {
    const mockUser = { id: 'u1', username: '迅捷猎豹#3F7K', avatar: '🦊', token: 'tok1', createdAt: '2026-01-01' };
    vi.mocked(versusApi.createAnonymous).mockResolvedValue({
      user: mockUser,
      token: 'tok1',
    });

    await useAuthStore.getState().ensureAuthenticated();

    expect(versusApi.createAnonymous).toHaveBeenCalled();
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().token).toBe('tok1');
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
  });

  it('ensureAuthenticated 有 token 时不重复建号', async () => {
    // 先手动设置已有 token
    useAuthStore.setState({ token: 'existing-tok' });
    // mock 一个 user 返回（实际会调 getMe）
    vi.mocked(versusApi.createAnonymous).mockResolvedValue({
      user: { id: 'u1', username: 'x', avatar: 'x', token: 'existing-tok', createdAt: '2026-01-01' },
      token: 'existing-tok',
    });

    await useAuthStore.getState().ensureAuthenticated();

    // 不应再调 createAnonymous
    expect(versusApi.createAnonymous).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd D:\BrainTrain\brain-train && npx vitest run tests/unit/authStore.test.ts`
Expected: FAIL，模块找不到。

- [ ] **Step 3: 实现 brain-train/src/lib/versusApi.ts**

```typescript
// 多人对战 REST 客户端：封装 fetch，自动带 token 头
import type { AuthResult, VersusUser } from '../types/versus';

// 后端地址：开发环境走 vite 代理或直连，生产走同源 /api
const API_BASE = import.meta.env.VITE_VERSUS_API_BASE ?? 'http://localhost:3001';

// 建匿名账号
export async function createAnonymous(): Promise<AuthResult> {
  const res = await fetch(`${API_BASE}/api/auth/anonymous`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`建号失败: ${res.status}`);
  return res.json();
}

// 查当前用户（用已有 token）
export async function getMe(token: string): Promise<VersusUser> {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`token 校验失败: ${res.status}`);
  const data = await res.json();
  return data.user;
}

export const versusApi = { createAnonymous, getMe };
```

- [ ] **Step 4: 实现 brain-train/src/stores/authStore.ts**

```typescript
// 多人对战 auth store：管理 token/user 状态，自动建号
import { create } from 'zustand';
import type { VersusUser } from '../types/versus';
import { versusApi } from '../lib/versusApi';

interface AuthState {
  user: VersusUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;

  // 确保已登录：无 token 则自动建号
  ensureAuthenticated: () => Promise<void>;
  // 重置（测试用 + 登出）
  reset: () => void;
  // 判断是否已登录
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  loading: false,
  error: null,

  isAuthenticated: () => get().token !== null && get().user !== null,

  ensureAuthenticated: async () => {
    const existingToken = get().token;
    if (existingToken) {
      // 已有 token，不重复建号（TODO 计划后续：从 IndexedDB 恢复 + 校验）
      return;
    }

    set({ loading: true, error: null });
    try {
      const { user, token } = await versusApi.createAnonymous();
      set({ user, token, loading: false });
      // TODO 计划后续：持久化 token 到 IndexedDB
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
      throw e;
    }
  },

  reset: () => set({ user: null, token: null, loading: false, error: null }),
}));
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd D:\BrainTrain\brain-train && npx vitest run tests/unit/authStore.test.ts`
Expected: PASS，3 个用例通过。

- [ ] **Step 6: Commit**

```bash
cd D:\BrainTrain
git add brain-train/src/lib/versusApi.ts brain-train/src/stores/authStore.ts brain-train/tests/unit/authStore.test.ts
git commit -m "feat(versus): 前端 authStore + REST 客户端"
```

---

## Task 11: 前端 versusSocket 连接管理

**Files:**
- Create: `brain-train/src/lib/versusSocket.ts`
- Test: `brain-train/tests/unit/versusSocket.test.ts`

- [ ] **Step 1: 写失败的测试 brain-train/tests/unit/versusSocket.test.ts**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { io as mockIo } from 'socket.io-client';

// mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  })),
}));

import { connectVersus, disconnectVersus } from '../../src/lib/versusSocket';

beforeEach(() => {
  vi.clearAllMocks();
  disconnectVersus();
});

describe('versusSocket', () => {
  it('connectVersus 带 token 调用 io() 连接', () => {
    connectVersus('my-token');

    expect(mockIo).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ auth: { token: 'my-token' } })
    );
  });

  it('重复 connectVersus 不重复创建连接', () => {
    connectVersus('token-a');
    connectVersus('token-a');

    expect(mockIo).toHaveBeenCalledTimes(1);
  });

  it('disconnectVersus 断开连接', () => {
    connectVersus('token-a');
    disconnectVersus();

    // 再次 connect 应该会创建新连接
    connectVersus('token-a');
    expect(mockIo).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd D:\BrainTrain\brain-train && npx vitest run tests/unit/versusSocket.test.ts`
Expected: FAIL，模块找不到。

- [ ] **Step 3: 实现 brain-train/src/lib/versusSocket.ts**

```typescript
// Socket.IO 连接管理：单例连接，带 token 鉴权
import { io, type Socket } from 'socket.io-client';

const SOCKET_BASE = import.meta.env.VITE_VERSUS_API_BASE ?? 'http://localhost:3001';

let socket: Socket | null = null;

// 连接到对战服务器（带 token）。单例：已连接则复用。
export function connectVersus(token: string): Socket {
  if (socket) return socket;

  socket = io(SOCKET_BASE, {
    auth: { token },
  });

  socket.on('connect_error', (err) => {
    console.error('[versus] socket 连接失败:', err.message);
  });

  return socket;
}

// 获取当前连接（未连接返回 null）
export function getSocket(): Socket | null {
  return socket;
}

// 断开连接
export function disconnectVersus(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd D:\BrainTrain\brain-train && npx vitest run tests/unit/versusSocket.test.ts`
Expected: PASS，3 个用例通过。

- [ ] **Step 5: Commit**

```bash
cd D:\BrainTrain
git add brain-train/src/lib/versusSocket.ts brain-train/tests/unit/versusSocket.test.ts
git commit -m "feat(versus): 前端 Socket.IO 连接管理（带 token 鉴权）"
```

---

## Task 12: 端到端冒烟（手动验证 + 文档）

**Files:**
- Create: `server/README.md`

此任务无代码，是手动验证整条链路打通。

- [ ] **Step 1: 启动后端**

```bash
cd D:\BrainTrain\server
cp .env.example .env  # 首次需要
npm run dev
```
Expected: `[server] 多人对战后端已启动，端口 3001`

- [ ] **Step 2: 验证 REST 建号**

```bash
curl -X POST http://localhost:3001/api/auth/anonymous
```
Expected: 返回 JSON，含 `user.id`、`user.username`、`token`。

把返回的 token 记下来，下一步用。

- [ ] **Step 3: 验证受保护路由**

```bash
curl http://localhost:3001/api/auth/me -H "Authorization: Bearer <上一步的token>"
```
Expected: 返回 `{ user: {...} }`。

不带 token 测：
```bash
curl http://localhost:3001/api/auth/me
```
Expected: 返回 401 `{ error: "未提供 token" }`。

- [ ] **Step 4: 验证 Socket.IO 鉴权（用浏览器 console）**

启动前端 `cd D:\BrainTrain\brain-train && npm run dev`，在浏览器 console 执行：

```javascript
// 先建号
const r = await fetch('http://localhost:3001/api/auth/anonymous', { method: 'POST' });
const { token } = await r.json();

// 连 socket
const sock = io('http://localhost:3001', { auth: { token } });
sock.on('connect', () => console.log('连接成功', sock.id));
sock.on('connect_error', (e) => console.log('连接失败', e.message));
```
Expected: 打印「连接成功 <socketid>」。

再试无效 token：
```javascript
const bad = io('http://localhost:3001', { auth: { token: '错的' } });
bad.on('connect_error', (e) => console.log('预期失败:', e.message));
```
Expected: 打印「预期失败: token 无效」。

- [ ] **Step 5: 写 server/README.md 部署说明**

```markdown
# BrainTrain 多人对战后端

## 开发环境准备

### 1. 装 Postgres（本机）

```bash
# 用 Docker（推荐）
docker run -d --name bt-pg \
  -e POSTGRES_USER=braintrain \
  -e POSTGRES_PASSWORD=braintrain \
  -e POSTGRES_DB=braintrain \
  -p 5432:5432 \
  postgres:16

# 建测试库
docker exec -it bt-pg psql -U braintrain -c "CREATE DATABASE braintrain_test;"
```

### 2. 配置环境变量

```bash
cd server
cp .env.example .env
```

### 3. 启动

```bash
npm install
npm run dev   # 热重载，端口 3001
```

### 4. 测试

```bash
npm test
```

## 生产部署（腾讯轻量服务器）

### Postgres

```bash
sudo apt install postgresql
sudo -u postgres psql -c "CREATE USER braintrain WITH PASSWORD '强密码';"
sudo -u postgres psql -c "CREATE DATABASE braintrain OWNER braintrain;"
```

### Node 服务（PM2 守护）

```bash
cd /data/server
npm ci --omit=dev
npm run build
pm2 start dist/index.js --name braintrain-server
pm2 save
pm2 startup
```

### Nginx 反代（追加到现有配置）

```nginx
# 在现有 server 块内追加
location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

location /socket.io/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

### .env（生产）

```env
DATABASE_URL=postgresql://braintrain:强密码@localhost:5432/braintrain
PORT=3001
CORS_ORIGIN=https://你的域名
```
```

- [ ] **Step 6: Commit**

```bash
cd D:\BrainTrain
git add server/README.md
git commit -m "docs(server): 后端开发与部署说明"
```

---

## 完成标志

本计划完成后应满足：

1. ✅ `cd server && npm test` 全绿（authService、authRepository、authRoutes、socketAuth、db、app 所有用例）
2. ✅ `cd brain-train && npm test` 全绿（含新增 authStore、versusSocket 测试，且原有测试不回归）
3. ✅ 手动冒烟：REST 建号 → 带 token 调 /me → Socket.IO 带 token 连接成功、无效 token 被拒
4. ✅ 后端能 `npm run dev` 启动，监听 3001

## 后续计划交接

本计划交付的接口，供后续计划使用：

- **计划二（Room Engine）**：复用 `attachAuthMiddleware`（已装在 io 上），用 `socket.userId` / `socket.userName` 标识玩家；Room Engine 注册新的 socket 事件处理器。
- **计划四（排行榜）**：扩展 `schema.sql` 加 `matches` / `user_stats` 表；扩展 `authRepository` 或新增 stats 模块。
- **前端后续**：`useAuthStore` 提供 token，供 `versusSocket.connectVersus(token)` 用。

---

## Self-Review（计划自检）

**Spec 覆盖检查（spec 第 2、3、7 章）：**

| Spec 要求 | 对应任务 | 状态 |
|---|---|---|
| 后端 4 单元中的 Auth | Task 4-7 | ✅ |
| 服务器权威（基础：鉴权层就位） | Task 7（socket 鉴权） | ✅ |
| users 表（id/username/avatar/token/created_at） | Task 3 schema | ✅ |
| 匿名建号流程 | Task 6 + Task 10 | ✅ |
| token = UUID，存表，查表比对 | Task 4 + Task 5 | ✅ |
| token 存 IndexedDB | Task 9 Dexie 表（注：实际持久化在后续计划完善，本计划 authStore 先在内存） | ⚠️ 部分覆盖 |
| Socket.IO 鉴权（handshake.auth.token） | Task 7 | ✅ |
| 前端 Auth Client 单元 | Task 9-11 | ✅ |
| Node + Express + Socket.IO + Postgres 技术栈 | Task 1-8 | ✅ |
| Nginx 反代 /api 和 /socket.io | Task 12 README | ✅ |

**已知简化（本计划范围外，后续计划补）：**
- token 持久化到 IndexedDB + 启动时恢复：authStore 当前只在内存，Task 10 留了 TODO 注释。完整持久化在计划二开始时补（避免本计划过大）。这是有意控制范围，不影响本计划独立可测。
