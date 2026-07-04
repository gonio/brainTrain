# 多人对战 - 计划四：战绩 + 排行榜（D 阶段，收官）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `game:end` 的结果落库（matches + user_stats 表），提供 REST 排行榜接口，前端 Leaderboard 占位换成真实数据。完成后整个 spec 100% 交付。

**Architecture:** 后端：扩展 schema 加两表、新建 `statsRepository.ts`（写战绩 + 增量更新 user_stats，事务）、新建 `leaderboardRoutes.ts`（GET /api/leaderboard + /api/me/stats）、`endGame` 里调 `recordMatch`（异步，不阻塞广播）。前端：`versusApi` 加两个接口、Leaderboard 页换真实数据 + 自己排名 + 未上榜提示。

**Tech Stack:** Node 20, TypeScript, Express, Postgres（pg），React 19，Vitest（后端纯逻辑 + 集成，前端 store/页）。

**Spec:** `brain-train/docs/superpowers/specs/2026-07-04-multiplayer-versus-design.md`（第 6 章）

---

## 范围边界

**本计划做：** matches/user_stats 表、战绩写入（含断线判负记录）、增量更新 user_stats、排行榜查询（5 局门槛 + 正确率主排序 + 时间次排序）、/api/me/stats、前端 Leaderboard 真实数据。

**已知限制（spec 明确，本计划不防）：** 匿名账号可删号重建重置战绩 → 排行榜可刷。第一版不防，记为已知限制。

---

## 文件结构总览

### 新增后端文件

| 文件 | 职责 |
|---|---|
| `src/stats/statsRepository.ts` | 写战绩 + 增量更新 user_stats（事务） + 查排行榜 + 查个人统计 |
| `src/stats/leaderboardRoutes.ts` | Express 路由：GET /api/leaderboard、GET /api/me/stats |

### 改动后端文件

| 文件 | 改动 |
|---|---|
| `schema.sql` | 加 matches + user_stats 两表 |
| `src/app.ts` | 挂载 leaderboardRoutes（在 authRouter 后） |
| `src/rooms/roomHandlers.ts` | endGame 里 emit game:end 后调 recordMatch（异步） |

### 新增/改动前端文件

| 文件 | 改动 |
|---|---|
| `src/lib/versusApi.ts` | 加 getLeaderboard + getMyStats |
| `src/types/versus.ts` | 加 LeaderboardEntry/LeaderboardResponse/MyStats 类型 |
| `src/pages/Leaderboard.tsx` | 占位换成真实数据（Top 50 + 自己排名 + 未上榜提示） |

### 新增测试

| 文件 | 覆盖 |
|---|---|
| `server/tests/statsRepository.test.ts` | 写战绩/增量更新/查询（集成，需 DB） |
| `server/tests/leaderboardRoutes.test.ts` | REST 接口（集成，需 DB） |

---

## 任务依赖图

```
Task 1 (schema 两表 + statsRepository) [TDD-集成] ─→ Task 2 (leaderboardRoutes) [TDD-集成]
                                                          │
                                                          ↓
Task 3 (endGame 接 recordMatch + app.ts 挂路由)
                                                          │
                                                          ↓
Task 4 (前端 versusApi + 类型 + Leaderboard 真实数据)
                                                          │
                                                          ↓
Task 5 (服务器部署 + 端到端验证)
```

Task 1/2 是 DB 集成测试（本地无 DB 跑不了，服务器跑）。Task 3 接入。Task 4 前端。Task 5 部署。

---

## Task 1: schema 扩展 + statsRepository（TDD 集成）

**Files:**
- Modify: `server/schema.sql`
- Create: `server/src/stats/statsRepository.ts`
- Test: `server/tests/statsRepository.test.ts`

- [ ] **Step 1: 扩展 schema.sql，加两表**

读现有 `server/schema.sql`（只有 users 表）。在末尾追加：

```sql
-- 每局战绩（房间 finished 时写入）
CREATE TABLE IF NOT EXISTS matches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     TEXT NOT NULL,
  game_mode   TEXT NOT NULL DEFAULT 'schulte',
  winner_id   UUID,             -- 平局为 NULL
  played_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  players     JSONB NOT NULL    -- [{ playerId, name, avatar, found, errors, accuracy, timeMs, done, won }]
);

-- 用户统计（聚合缓存，每局后增量更新）
CREATE TABLE IF NOT EXISTS user_stats (
  user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  matches_played INT NOT NULL DEFAULT 0,
  wins           INT NOT NULL DEFAULT 0,
  losses         INT NOT NULL DEFAULT 0,
  draws          INT NOT NULL DEFAULT 0,
  total_correct  INT NOT NULL DEFAULT 0,
  total_errors   INT NOT NULL DEFAULT 0,
  total_time_ms  BIGINT NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 排行榜查询：按平均正确率降序、平均时间升序
CREATE INDEX IF NOT EXISTS idx_user_stats_accuracy_time ON user_stats (total_correct, total_errors, total_time_ms);
```

注意：`user_stats.user_id` 加了 `REFERENCES users(id) ON DELETE CASCADE`——用户删了统计也删（虽然第一版没删号功能，但约束好）。`clearTables`（db.ts）现有 `TRUNCATE TABLE users CASCADE` 会级联清 user_stats，但 matches 没有 FK 到 users（players 是 JSONB），需在 clearTables 里也清 matches。

- [ ] **Step 2: 更新 db.ts 的 clearTables，加 matches 清理**

读 `server/src/db.ts`，把 `clearTables` 从：
```typescript
export async function clearTables(): Promise<void> {
  await pool.query('TRUNCATE TABLE users CASCADE');
}
```
改为：
```typescript
export async function clearTables(): Promise<void> {
  await pool.query('TRUNCATE TABLE matches CASCADE');
  await pool.query('TRUNCATE TABLE users CASCADE');
}
```
（matches 先清，因为它无 FK；users CASCADE 会清 user_stats。）

- [ ] **Step 3: 写失败测试 `server/tests/statsRepository.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { recordMatch, getLeaderboard, getMyStats } from '../src/stats/statsRepository.js';
import { createUser } from '../src/auth/authRepository.js';
import { generateUsername, generateAvatar, generateToken } from '../src/auth/authService.js';
import './setupDb.js';

async function makeUser() {
  return createUser({ username: generateUsername(), avatar: generateAvatar(), token: generateToken() });
}

const matchInput = (aId: string, bId: string, aWon: boolean) => ({
  roomId: 'r1',
  gameMode: 'schulte' as const,
  winnerId: aWon ? aId : aWon === false ? bId : null,
  players: [
    { playerId: aId, name: 'A', avatar: '🦊', found: 25, errors: 0, accuracy: 1, timeMs: 30000, done: true, won: aWon },
    { playerId: bId, name: 'B', avatar: '🐰', found: 20, errors: 5, accuracy: 0.8, timeMs: 90000, done: false, won: !aWon && aWon !== null ? true : false },
  ],
});

describe('statsRepository', () => {
  it('recordMatch 写入 matches 表并增量更新双方 user_stats', async () => {
    const a = await makeUser();
    const b = await makeUser();
    await recordMatch(matchInput(a.id, b.id, true));

    const statsA = await getMyStats(a.id);
    expect(statsA?.matches_played).toBe(1);
    expect(statsA?.wins).toBe(1);
    expect(statsA?.losses).toBe(0);
    expect(statsA?.total_correct).toBe(25);
    expect(statsA?.total_errors).toBe(0);

    const statsB = await getMyStats(b.id);
    expect(statsB?.matches_played).toBe(1);
    expect(statsB?.wins).toBe(0);
    expect(statsB?.losses).toBe(1);
    expect(statsB?.total_correct).toBe(20);
    expect(statsB?.total_errors).toBe(5);
  });

  it('recordMatch 多局累加（增量）', async () => {
    const a = await makeUser();
    const b = await makeUser();
    await recordMatch(matchInput(a.id, b.id, true));
    await recordMatch(matchInput(a.id, b.id, true));
    const statsA = await getMyStats(a.id);
    expect(statsA?.matches_played).toBe(2);
    expect(statsA?.wins).toBe(2);
    expect(statsA?.total_correct).toBe(50);
  });

  it('recordMatch 平局：双方 draws+1，winner_id 为 null', async () => {
    const a = await makeUser();
    const b = await makeUser();
    // 造平局：双方 accuracy 和 timeMs 相同
    await recordMatch({
      roomId: 'r2', gameMode: 'schulte', winnerId: null,
      players: [
        { playerId: a.id, name: 'A', avatar: '🦊', found: 25, errors: 0, accuracy: 1, timeMs: 30000, done: true, won: false },
        { playerId: b.id, name: 'B', avatar: '🐰', found: 25, errors: 0, accuracy: 1, timeMs: 30000, done: true, won: false },
      ],
    });
    expect((await getMyStats(a.id))?.draws).toBe(1);
    expect((await getMyStats(b.id))?.draws).toBe(1);
  });

  it('getMyStats 不存在返回 null', async () => {
    expect(await getMyStats('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('getLeaderboard：5 局门槛 + 正确率主排序', async () => {
    // a 打 5 局全胜 100%，b 打 4 局（不到门槛），c 打 5 局 80%
    const a = await makeUser(); const b = await makeUser(); const c = await makeUser();
    for (let i = 0; i < 5; i++) await recordMatch(matchInput(a.id, c.id, true));
    for (let i = 0; i < 4; i++) await recordMatch(matchInput(b.id, c.id, true));

    const lb = await getLeaderboard(50);
    // 只有 a 和 c 上榜（>= 5 局），b 不在
    const ids = lb.map((e) => e.userId);
    expect(ids).toContain(a.id);
    expect(ids).toContain(c.id);
    expect(ids).not.toContain(b.id);
    // a 正确率 100% > c，排第一
    expect(lb[0].userId).toBe(a.id);
  });

  it('getLeaderboard 正确率相同按时间升序', async () => {
    const a = await makeUser(); const b = await makeUser();
    // 双方都 5 局全胜 100%，但 a 更快（timeMs 更小）
    for (let i = 0; i < 5; i++) {
      await recordMatch({
        roomId: `r-a-${i}`, gameMode: 'schulte', winnerId: a.id,
        players: [
          { playerId: a.id, name: 'A', avatar: '🦊', found: 25, errors: 0, accuracy: 1, timeMs: 10000, done: true, won: true },
          { playerId: b.id, name: 'B', avatar: '🐰', found: 25, errors: 0, accuracy: 1, timeMs: 20000, done: true, won: false },
        ],
      });
    }
    const lb = await getLeaderboard(50);
    expect(lb[0].userId).toBe(a.id); // a 更快，排前
  });

  it('getLeaderboard 带 myId 时返回 myEntry（即使不在前 50）', async () => {
    const a = await makeUser();
    for (let i = 0; i < 5; i++) await recordMatch(matchInput(a.id, (await makeUser()).id, true));
    const lb = await getLeaderboard(50, a.id);
    expect(lb.myEntry?.userId).toBe(a.id);
  });
});
```

- [ ] **Step 4: 跑测试确认失败（本地无 DB）**

Run: `cd D:\BrainTrain\server && npx vitest run tests/statsRepository.test.ts`
Expected: FAIL — 模块找不到 / DB 连接失败。

- [ ] **Step 5: 实现 `server/src/stats/statsRepository.ts`**

```typescript
// 战绩 + 排行榜数据访问层。
import { pool } from '../db.js';

// 写入的单玩家结果（来自 endGame 的 PlayerResult + name/avatar）
export interface MatchPlayerInput {
  playerId: string;
  name: string;
  avatar: string;
  found: number;
  errors: number;
  accuracy: number;
  timeMs: number;
  done: boolean;
  won: boolean;
}

export interface RecordMatchInput {
  roomId: string;
  gameMode: string;
  winnerId: string | null;
  players: MatchPlayerInput[];
}

// 排行榜条目
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar: string;
  matchesPlayed: number;
  avgAccuracy: number;   // 0-1
  avgTimeMs: number;
  wins: number;
  losses: number;
  draws: number;
}

// 个人统计
export interface UserStatsRow {
  user_id: string;
  matches_played: number;
  wins: number;
  losses: number;
  draws: number;
  total_correct: number;
  total_errors: number;
  total_time_ms: number;
}

// 写战绩 + 事务内增量更新双方 user_stats
export async function recordMatch(input: RecordMatchInput): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. 写 matches
    await client.query(
      `INSERT INTO matches (room_id, game_mode, winner_id, players)
       VALUES ($1, $2, $3, $4)`,
      [input.roomId, input.gameMode, input.winnerId, JSON.stringify(input.players)],
    );

    // 2. 增量更新双方 user_stats（UPSERT）
    for (const p of input.players) {
      const result = p.won ? 'wins' : input.winnerId === null ? 'draws' : 'losses';
      await client.query(
        `INSERT INTO user_stats (user_id, matches_played, wins, losses, draws, total_correct, total_errors, total_time_ms, updated_at)
         VALUES ($1, 1, $2, $3, $4, $5, $6, $7, now())
         ON CONFLICT (user_id) DO UPDATE SET
           matches_played = user_stats.matches_played + 1,
           wins = user_stats.wins + $2,
           losses = user_stats.losses + $3,
           draws = user_stats.draws + $4,
           total_correct = user_stats.total_correct + $5,
           total_errors = user_stats.total_errors + $6,
           total_time_ms = user_stats.total_time_ms + $7,
           updated_at = now()`,
        [
          p.playerId,
          result === 'wins' ? 1 : 0,
          result === 'losses' ? 1 : 0,
          result === 'draws' ? 1 : 0,
          p.found,
          p.errors,
          p.timeMs,
        ],
      );
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// 查个人统计
export async function getMyStats(userId: string): Promise<UserStatsRow | null> {
  const result = await pool.query(
    `SELECT user_id, matches_played, wins, losses, draws, total_correct, total_errors, total_time_ms
     FROM user_stats WHERE user_id = $1`,
    [userId],
  );
  if (result.rows.length === 0) return null;
  return result.rows[0] as UserStatsRow;
}

// 查排行榜：>= 5 局，按平均正确率降序、平均时间升序
// 返回 { entries, myEntry? }
export async function getLeaderboard(
  limit: number,
  myUserId?: string,
): Promise<{ entries: LeaderboardEntry[]; myEntry: LeaderboardEntry | null }> {
  // 平均正确率 = total_correct / (total_correct + total_errors)
  // 用一个排序表达式：accuracy DESC, avg_time ASC
  const result = await pool.query(
    `SELECT
       s.user_id, u.username, u.avatar,
       s.matches_played, s.wins, s.losses, s.draws,
       s.total_correct, s.total_errors, s.total_time_ms,
       CASE WHEN s.total_correct + s.total_errors = 0 THEN 0
            ELSE s.total_correct::float / (s.total_correct + s.total_errors) END AS avg_accuracy,
       CASE WHEN s.matches_played = 0 THEN 0
            ELSE s.total_time_ms::float / s.matches_played END AS avg_time_ms
     FROM user_stats s
     JOIN users u ON u.id = s.user_id
     WHERE s.matches_played >= 5
     ORDER BY avg_accuracy DESC, avg_time_ms ASC, s.user_id ASC`,
  );

  const entries: LeaderboardEntry[] = result.rows.map((row, idx) => ({
    rank: idx + 1,
    userId: row.user_id,
    username: row.username,
    avatar: row.avatar,
    matchesPlayed: row.matches_played,
    avgAccuracy: parseFloat(row.avg_accuracy),
    avgTimeMs: parseFloat(row.avg_time_ms),
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
  }));

  const trimmed = entries.slice(0, limit);

  // 找 myEntry（即使不在前 limit）
  let myEntry: LeaderboardEntry | null = null;
  if (myUserId) {
    myEntry = entries.find((e) => e.userId === myUserId) ?? null;
  }

  return { entries: trimmed, myEntry };
}
```

- [ ] **Step 6: 跑测试（本地无 DB 会失败，服务器跑全绿）**

Run: `cd D:\BrainTrain\server && npx vitest run tests/statsRepository.test.ts`

- [ ] **Step 7: Commit**

```bash
cd D:\BrainTrain
git add server/schema.sql server/src/db.ts server/src/stats/statsRepository.ts server/tests/statsRepository.test.ts
git commit -m "feat(stats): 战绩写入 + user_stats 聚合 + 排行榜查询"
```

---

## Task 2: leaderboardRoutes（REST 接口 TDD 集成）

**Files:**
- Create: `server/src/stats/leaderboardRoutes.ts`
- Test: `server/tests/leaderboardRoutes.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildTestApp } from './helpers.js';
import { createUser } from '../src/auth/authRepository.js';
import { generateUsername, generateAvatar, generateToken } from '../src/auth/authService.js';
import { recordMatch } from '../src/stats/statsRepository.js';
import './setupDb.js';

async function makeUser() {
  return createUser({ username: generateUsername(), avatar: generateAvatar(), token: generateToken() });
}

describe('leaderboardRoutes', () => {
  it('GET /api/leaderboard 返回 entries（可能空）', async () => {
    const app = await buildTestApp();
    const res = await request(app).get('/api/leaderboard?mode=schulte&limit=50');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.entries)).toBe(true);
  });

  it('GET /api/leaderboard 带 token 返回 myEntry（打过 5 局后）', async () => {
    const app = await buildTestApp();
    const a = await makeUser();
    for (let i = 0; i < 5; i++) {
      const b = await makeUser();
      await recordMatch({
        roomId: `r${i}`, gameMode: 'schulte', winnerId: a.id,
        players: [
          { playerId: a.id, name: 'A', avatar: '🦊', found: 25, errors: 0, accuracy: 1, timeMs: 30000, done: true, won: true },
          { playerId: b.id, name: 'B', avatar: '🐰', found: 10, errors: 15, accuracy: 0.4, timeMs: 90000, done: false, won: false },
        ],
      });
    }
    const res = await request(app).get('/api/leaderboard?mode=schulte&limit=50').set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body.myEntry?.userId).toBe(a.id);
    expect(res.body.myEntry?.matchesPlayed).toBe(5);
  });

  it('GET /api/me/stats 带 token 返回自己的统计', async () => {
    const app = await buildTestApp();
    const a = await makeUser();
    const b = await makeUser();
    await recordMatch({
      roomId: 'r1', gameMode: 'schulte', winnerId: a.id,
      players: [
        { playerId: a.id, name: 'A', avatar: '🦊', found: 25, errors: 0, accuracy: 1, timeMs: 30000, done: true, won: true },
        { playerId: b.id, name: 'B', avatar: '🐰', found: 20, errors: 5, accuracy: 0.8, timeMs: 90000, done: false, won: false },
      ],
    });
    const res = await request(app).get('/api/me/stats').set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body.matchesPlayed).toBe(1);
    expect(res.body.wins).toBe(1);
    expect(res.body.avgAccuracy).toBeCloseTo(1, 5);
  });

  it('GET /api/me/stats 未打过返回空统计（matchesPlayed=0）', async () => {
    const app = await buildTestApp();
    const a = await makeUser();
    const res = await request(app).get('/api/me/stats').set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body.matchesPlayed).toBe(0);
  });

  it('GET /api/me/stats 无 token 返回 401', async () => {
    const app = await buildTestApp();
    const res = await request(app).get('/api/me/stats');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 更新 tests/helpers.ts 的 buildTestApp 挂载 leaderboardRoutes**

读 `server/tests/helpers.ts`，在 authRouter 后加 leaderboardRoutes：

```typescript
import { leaderboardRouter } from '../src/stats/leaderboardRoutes.js';
// ...
app.use('/api/auth', authRouter);
app.use('/api', leaderboardRouter);  // 提供 /api/leaderboard 和 /api/me/stats
```

- [ ] **Step 3: 跑测试确认失败**

Run: `cd D:\BrainTrain\server && npx vitest run tests/leaderboardRoutes.test.ts`
Expected: FAIL — 模块找不到。

- [ ] **Step 4: 实现 `server/src/stats/leaderboardRoutes.ts`**

```typescript
// 排行榜 + 个人统计路由
import { Router } from 'express';
import { requireAuth } from '../auth/authMiddleware.js';
import { getLeaderboard, getMyStats } from './statsRepository.js';

export const leaderboardRouter = Router();

// GET /api/leaderboard?mode=schulte&limit=50
leaderboardRouter.get('/leaderboard', requireAuth, async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10), 100);
  const myUserId = req.user?.id;
  const { entries, myEntry } = await getLeaderboard(limit, myUserId);
  res.json({ entries, myEntry });
});

// GET /api/me/stats
leaderboardRouter.get('/me/stats', requireAuth, async (req, res) => {
  const stats = await getMyStats(req.user!.id);
  if (!stats) {
    // 未打过：返回空统计
    res.json({
      matchesPlayed: 0, wins: 0, losses: 0, draws: 0,
      avgAccuracy: 0, avgTimeMs: 0,
    });
    return;
  }
  const denom = stats.total_correct + stats.total_errors;
  res.json({
    matchesPlayed: stats.matches_played,
    wins: stats.wins,
    losses: stats.losses,
    draws: stats.draws,
    avgAccuracy: denom === 0 ? 0 : stats.total_correct / denom,
    avgTimeMs: stats.matches_played === 0 ? 0 : Math.round(stats.total_time_ms / stats.matches_played),
  });
});
```

注意：两个路由都用 `requireAuth`（需要 token 才能查，且 myEntry/me 需要知道当前用户）。limit 上限 100 防滥用。

- [ ] **Step 5: 跑测试（本地无 DB 失败，服务器全绿）**

Run: `cd D:\BrainTrain\server && npx vitest run tests/leaderboardRoutes.test.ts`

- [ ] **Step 6: Commit**

```bash
cd D:\BrainTrain
git add server/src/stats/leaderboardRoutes.ts server/tests/leaderboardRoutes.test.ts server/tests/helpers.ts
git commit -m "feat(stats): 排行榜 + 个人统计 REST 接口"
```

---

## Task 3: endGame 接 recordMatch + app.ts 挂路由

**Files:**
- Modify: `server/src/rooms/roomHandlers.ts`
- Modify: `server/src/app.ts`

- [ ] **Step 1: app.ts 挂载 leaderboardRoutes**

读 `server/src/app.ts`，在 `app.use('/api/auth', authRouter);` 后加：

```typescript
import { leaderboardRouter } from './stats/leaderboardRoutes.js';
// ...
app.use('/api/auth', authRouter);
app.use('/api', leaderboardRouter);
```

- [ ] **Step 2: roomHandlers.ts 的 endGame 接 recordMatch**

读 `server/src/rooms/roomHandlers.ts`。在文件顶部加 import：

```typescript
import { recordMatch, type MatchPlayerInput } from '../stats/statsRepository.js';
```

在 `endGame` 函数里，`emitGameEndTo` 调用之后、`games.remove` 之前，插入战绩写入（异步，不阻塞广播）：

```typescript
    // 给双方发 game:end（各自「我」视角）
    emitGameEndTo(aId, aResult, bResult);
    emitGameEndTo(bId, bResult, aResult);

    // 写战绩（异步，不阻塞游戏流程；失败只记日志）
    const playersForStats: MatchPlayerInput[] = [
      { playerId: aId, name: /* A 的 name */, avatar: /* A 的 avatar */, ...aResult },
      { playerId: bId, name: /* B 的 name */, avatar: /* B 的 avatar */, ...bResult },
    ];
    const winnerId = aResult.won ? aId : bResult.won ? bId : null;
    recordMatch({
      roomId: room.roomId,
      gameMode: 'schulte',
      winnerId,
      players: playersForStats,
    }).catch((err) => console.error('[stats] 战绩写入失败:', err));
```

**关键：** `MatchPlayerInput` 需要 `name` 和 `avatar`，而 `PlayerResult` 没有。从 `room.players` 里取：

```typescript
    const playerA = room.players.find((p) => p.id === aId);
    const playerB = room.players.find((p) => p.id === bId);
    const playersForStats: MatchPlayerInput[] = [
      { playerId: aId, name: playerA?.name ?? '未知', avatar: playerA?.avatar ?? '❓', found: aResult.found, errors: aResult.errors, accuracy: aResult.accuracy, timeMs: aResult.timeMs, done: aResult.done, won: aResult.won },
      { playerId: bId, name: playerB?.name ?? '未知', avatar: playerB?.avatar ?? '❓', found: bResult.found, errors: bResult.errors, accuracy: bResult.accuracy, timeMs: bResult.timeMs, done: bResult.done, won: bResult.won },
    ];
```

把这段放在 emit 之后。`winnerId` 计算：`aResult.won ? aId : bResult.won ? bId : null`（平局 null）。

> 实现者：以 `tsc --noEmit` 0 错误为准。注意 recordMatch 是 async 但这里 fire-and-forget（.catch 记日志），不 await（避免阻塞房间状态切换）。

- [ ] **Step 3: tsc 检查**

Run: `cd D:\BrainTrain\server && npx tsc --noEmit`
Expected: 0 错误。

- [ ] **Step 4: 跑现有测试无回归（无 DB 部分）**

Run: `cd D:\BrainTrain\server && npx vitest run tests/schulteGame.test.ts tests/gameStore.test.ts tests/roomStateMachine.test.ts tests/roomHelpers.test.ts tests/roomStore.test.ts tests/lobbyService.test.ts tests/matchService.test.ts tests/authService.test.ts tests/app.test.ts`
Expected: 全绿。

- [ ] **Step 5: Commit**

```bash
cd D:\BrainTrain
git add server/src/app.ts server/src/rooms/roomHandlers.ts
git commit -m "feat(stats): endGame 接战绩写入 + app 挂排行榜路由"
```

---

## Task 4: 前端 versusApi + 类型 + Leaderboard 真实数据

**Files:**
- Modify: `brain-train/src/types/versus.ts`
- Modify: `brain-train/src/lib/versusApi.ts`
- Modify: `brain-train/src/pages/Leaderboard.tsx`

- [ ] **Step 1: 扩展 types/versus.ts，加排行榜类型**

在末尾追加：

```typescript
// ============ 排行榜类型 ============

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar: string;
  matchesPlayed: number;
  avgAccuracy: number;
  avgTimeMs: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  myEntry: LeaderboardEntry | null;
}

export interface MyStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  avgAccuracy: number;
  avgTimeMs: number;
}
```

- [ ] **Step 2: versusApi.ts 加两个接口**

读 `brain-train/src/lib/versusApi.ts`。加：

```typescript
import type { AuthResult, VersusUser, LeaderboardResponse, MyStats } from '../types/versus';

// 查排行榜（带 token）
export async function getLeaderboard(token: string, limit = 50): Promise<LeaderboardResponse> {
  const res = await fetch(`${API_BASE}/api/leaderboard?mode=schulte&limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`排行榜查询失败: ${res.status}`);
  return res.json();
}

// 查自己统计
export async function getMyStats(token: string): Promise<MyStats> {
  const res = await fetch(`${API_BASE}/api/me/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`统计查询失败: ${res.status}`);
  return res.json();
}
```

并把 `versusApi` 导出对象扩展：
```typescript
export const versusApi = { createAnonymous, getMe, getLeaderboard, getMyStats };
```

- [ ] **Step 3: Leaderboard.tsx 换真实数据**

替换占位实现（读现有 `brain-train/src/pages/Leaderboard.tsx`）：

```typescript
import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { versusApi } from '../lib/versusApi';
import type { LeaderboardEntry, MyStats } from '../types/versus';

export function Leaderboard() {
  const { token, ensureAuthenticated } = useAuthStore();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myEntry, setMyEntry] = useState<LeaderboardEntry | null>(null);
  const [myStats, setMyStats] = useState<MyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await ensureAuthenticated();
        const t = useAuthStore.getState().token;
        if (!t) return;
        const [lb, stats] = await Promise.all([
          versusApi.getLeaderboard(t),
          versusApi.getMyStats(t),
        ]);
        setEntries(lb.entries);
        setMyEntry(lb.myEntry);
        setMyStats(stats);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuthenticated]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中…</div>;
  if (error) return <div className="text-center py-12 text-destructive">加载失败：{error}</div>;

  return (
    <div className="space-y-6">
      <h1 className="font-headline text-2xl font-extrabold">排行榜</h1>

      {/* 我的统计卡片 */}
      {myStats && (
        <div className="bg-primary/10 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold">我的战绩</span>
            {myEntry ? (
              <span className="text-sm text-primary font-bold">第 {myEntry.rank} 名</span>
            ) : (
              <span className="text-xs text-muted-foreground">
                {myStats.matchesPlayed < 5 ? `再打 ${5 - myStats.matchesPlayed} 局即可上榜` : '未上榜'}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <div className="font-bold">{myStats.matchesPlayed}</div>
              <div className="text-xs text-muted-foreground">场次</div>
            </div>
            <div>
              <div className="font-bold">{(myStats.avgAccuracy * 100).toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">正确率</div>
            </div>
            <div>
              <div className="font-bold">{myStats.wins}胜{myStats.losses}负</div>
              <div className="text-xs text-muted-foreground">胜负</div>
            </div>
          </div>
        </div>
      )}

      {/* 排行榜列表 */}
      {entries.length === 0 ? (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-5xl text-muted-foreground mb-3 block">leaderboard</span>
          <p className="text-muted-foreground">还没有玩家上榜</p>
          <p className="text-xs text-muted-foreground mt-1">完成至少 5 局对战即可上榜</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isMe = entry.userId === myEntry?.userId;
            return (
              <div
                key={entry.userId}
                className={`flex items-center gap-3 p-3 rounded-xl ${isMe ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-surface-container'}`}
              >
                <span className={`font-headline font-extrabold text-lg w-8 text-center ${
                  entry.rank === 1 ? 'text-yellow-500' : entry.rank === 2 ? 'text-gray-400' : entry.rank === 3 ? 'text-orange-700' : 'text-muted-foreground'
                }`}>
                  {entry.rank}
                </span>
                <span className="text-2xl">{entry.avatar}</span>
                <div className="flex-1">
                  <div className="font-bold text-sm">{entry.username}{isMe && <span className="text-primary">（我）</span>}</div>
                  <div className="text-xs text-muted-foreground">
                    {(entry.avgAccuracy * 100).toFixed(1)}% · {(entry.avgTimeMs / 1000).toFixed(1)}s · {entry.wins}胜{entry.losses}负
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{entry.matchesPlayed}局</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: build + 测试无回归**

Run: `cd D:\BrainTrain\brain-train && npm run build`
Expected: 成功。

Run: `cd D:\BrainTrain\brain-train && npx vitest run 2>&1 | tail -5`
Expected: 全绿（202，无回归）。

- [ ] **Step 5: Commit**

```bash
cd D:\BrainTrain
git add brain-train/src/types/versus.ts brain-train/src/lib/versusApi.ts brain-train/src/pages/Leaderboard.tsx
git commit -m "feat(versus): 排行榜真实数据（Top 50 + 自己排名 + 个人统计）"
```

---

## Task 5: 服务器部署 + 端到端验证

**Files:** 无（部署 + 手动验证）

- [ ] **Step 1: 后端部署（schema 变更需要 initSchema 重建表）**

```bash
cd D:\BrainTrain
tar --exclude='server/node_modules' --exclude='server/dist' --exclude='server/.env' -czf /tmp/server.tar.gz server/
scp -i "C:/Users/xxzoi/.ssh/DOKE.pem" /tmp/server.tar.gz ubuntu@dokeplay.icu:/tmp/server.tar.gz
ssh -i "C:/Users/xxzoi/.ssh/DOKE.pem" ubuntu@dokeplay.icu 'cd /data && tar -xzf /tmp/server.tar.gz && cd /data/server && npm install && npm run build && pm2 restart braintrain-server && sleep 2 && pm2 logs braintrain-server --nostream --lines 3'
```
注意：schema.sql 用 `CREATE TABLE IF NOT EXISTS`，PM2 重启时 initSchema 会自动加新表（不破坏现有 users 数据）。

- [ ] **Step 2: 前端部署**

```bash
cd D:\BrainTrain\brain-train && npm run build
ssh -i "C:/Users/xxzoi/.ssh/DOKE.pem" ubuntu@dokeplay.icu 'rm -rf /data/www/*'
scp -r -i "C:/Users/xxzoi/.ssh/DOKE.pem" D:/BrainTrain/brain-train/dist/* ubuntu@dokeplay.icu:/data/www/
```

- [ ] **Step 3: 服务器跑全部后端测试**

```bash
ssh -i "C:/Users/xxzoi/.ssh/DOKE.pem" ubuntu@dokeplay.icu 'cd /data/server && npm test 2>&1 | tail -25'
```
Expected: 全绿（计划一~四所有测试）。

- [ ] **Step 4: 端到端验证**

a) 打几局对战（让战绩产生）：
```bash
# 跑 e2e 对战脚本 6 次（让某用户达到 5 局门槛）
```

b) 查排行榜接口：
```bash
powershell.exe -NoProfile -Command "走 /api/leaderboard"
```

c) 浏览器打开 `/leaderboard` 看真实数据。

- [ ] **Step 5: 清理**

```bash
rm -f D:/BrainTrain/brain-train/e2e-stats-test.mjs
ssh -i "C:/Users/xxzoi/.ssh/DOKE.pem" ubuntu@dokeplay.icu 'rm -f /tmp/server.tar.gz'
```

---

## 完成标志

1. ✅ `cd server && npm test` 全绿（计划一~四）
2. ✅ `cd brain-train && npm test` 全绿
3. ✅ 端到端：打几局 → 排行榜有数据 → /api/me/stats 正确
4. ✅ 浏览器 /leaderboard 显示真实排名 + 自己战绩

## 整个 spec 100% 交付

计划四完成后，spec 第 1-11 章全部实现。剩余只有第 11 章的「未决/后续」（断线重连、多游戏 PvP、ELO、4-8 人、防刷榜、观战）——这些是未来扩展，不在任何计划范围内。
