# 多人对战模式设计（Versus Mode）

- **日期**：2026-07-04
- **状态**：待实现
- **范围**：在现有单人训练之外新增多人对战能力，首版做舒尔特 1v1 实时同步竞速 + 大厅房间 + 匿名账号 + 准确率排行榜

## 1. 背景与目标

### 1.1 现状

- BrainTrain 是纯前端 PWA，静态部署到腾讯轻量服务器（4 核 4GB，国内地域，已有 Nginx + 域名），无任何后端。
- 4 个单人游戏（舒尔特 / Stroop / 序列记忆 / 暗瓶），加 Quest 闯关模式串联。
- 数据全在浏览器本地（IndexedDB + localStorage），无账号、无联网、无多人。

### 1.2 目标（本阶段）

- 引入实时后端，支持 2 人同房对战，为未来扩到 4–8 人留接口。
- 首版只做**舒尔特 1v1 同步竞速**，打通匹配 → 房间 → 对战 → 判胜负 → 记战绩 → 上排行榜整条链路。
- 支持**快速匹配**和**大厅房间列表**两条入口。
- 做一个**平均正确率排行榜**。
- 单人模式零改动，多人模式作为叠加功能。

### 1.3 非目标（本阶段不做）

- 注册 / 登录 / 邮箱密码 / 第三方 OAuth（首版纯匿名账号）。
- 序列 / Stroop / 暗瓶的 PvP（首版只舒尔特）。
- 4 人及以上的房间（架构留扩展点，但不实现）。
- 断线重连（断线即负）。
- 房间持久化（房间只在服务器内存，重启清空）。
- ELO / 段位匹配（匹配用先到先打）。
- 防匿名刷榜（接受匿名账号可重建的已知限制）。

### 1.4 为未来留的扩展点

- 人数上限参数化（`MAX_PLAYERS = 2`，后续改常量即可扩到 4/8）。
- 房间状态机与游戏规则解耦（Room Engine 不懂舒尔特规则，通过通用游戏模块接口调用），后续加新游戏只换游戏模块。
- `game_mode` 字段贯穿数据模型，后续加多游戏排行榜不用改表结构。

## 2. 总体架构

```
浏览器 (PWA, React SPA)
   │
   ├── REST  ──→  Nginx ──→  Node API (Express)
   │  (匿名建号/排行榜/战绩)        │
   │                                  ├── Postgres (users / matches / user_stats)
   │                                  └── Room Engine (内存, Socket.IO)
   │
   └── WebSocket ─→  Nginx ──→  Node Socket.IO (同一进程)
      (大厅/匹配/房间/对战实时进度)
```

**核心原则：API 与 Socket.IO 跑在同一个 Node 进程**。这样 Room Engine（内存态）能直接读写 Postgres 战绩，不需要进程间通信。Nginx 一并反代 `/api` 与 `/socket.io` 到该进程。

**核心原则：服务器权威**。前端不报「我得分了」，只报「我点了格子 X @ 时间 T」，服务器算分。题目、计时、胜负裁定全在服务器。防止客户端改内存作弊。

### 2.1 后端组件边界（4 个单元）

| 单元 | 职责 | 对外接口 | 依赖 |
|---|---|---|---|
| **Auth** | 匿名建号、发 token、校验 token | REST `/api/auth/*` + Socket.IO 鉴权中间件 | Postgres `users` 表 |
| **Room Engine** | 房间生命周期（创建/匹配/状态机/广播）、内存态权威 | Socket.IO 事件 | 纯内存；结束时调战绩写入 |
| **Match（匹配器）** | 快速匹配队列（先到先打），配对后交给 Room Engine | Socket.IO 事件 | Room Engine |
| **Score/Leaderboard** | 写战绩、聚合 user_stats、查排行榜 | REST `/api/leaderboard` `/api/me/stats` + 被 Room Engine 调用 | Postgres `matches` / `user_stats` 表 |

### 2.2 前端组件边界（3 个单元）

| 单元 | 职责 | 依赖 |
|---|---|---|
| **Auth Client** | 持有 token、自动建号 | 新增 `authStore` (Zustand) + IndexedDB 存 token |
| **Multiplayer Client** | Socket.IO 连接管理、大厅/匹配/房间/对战事件收发 | Socket.IO client + authStore |
| **Versus Schulte** | 舒尔特 PvP 渲染：对方进度条、统一开始、结果页 | 新建 `VersusSchulteBoard`，复用视觉样式，不改 `SchulteGrid` |

## 3. 账号系统（A 阶段）

纯匿名，进多人模式自动建号。无注册、无登录、无邮箱密码。

### 3.1 数据模型

```sql
users
  id          UUID PK
  username    TEXT NOT NULL        -- 随机生成，可改，不强制唯一
  avatar      TEXT                 -- 随机 emoji（或继承本地 profile 头像）
  token       TEXT NOT NULL UNIQUE -- 随机 UUID，鉴权用
  created_at  TIMESTAMPTZ
```

### 3.2 流程

1. 用户点「多人对战」→ 前端检查本地 IndexedDB 有无 token
2. 无 token → `POST /api/auth/anonymous` → 服务器建号返回 `{ user, token }`
3. token 存 IndexedDB（与本地 profile 一致，不走 localStorage）
4. 之后每次 REST 请求带 `Authorization: Bearer <token>`，Socket.IO 连接在 `auth` 字段带 token

### 3.3 Token 机制

- token = 随机 UUID（非 JWT），服务器存 `users.token` 列查表比对。
- 单 token，无过期。**清浏览器数据 = 丢号**（匿名模式的固有代价，本阶段接受）。

### 3.4 用户名与头像

- 随机生成昵称（如「迅捷猎豹#3F7K」），用户可在 Profile 改。
- 不强制唯一，靠 `id` 区分。
- 首次建号随机给一个 emoji 头像；可将本地 profile 的头像昵称带上预填（顺手，不算优化）。

### 3.5 对单人模式的影响

零影响。单人模式继续用本地 profile（IndexedDB `id:'default'`），多人模式用服务端匿名号 + token，两条线互不干扰。

## 4. 房间系统与匹配（B 阶段）

### 4.1 房间状态机

房间是临时态，完全存在服务器内存（不进数据库）。

```
waiting ──(人齐)──→ ready ──(房主点开始)──→ countdown ──(倒计时结束)──→ playing ──(双方提交或超时)──→ finished ──(结果展示完)──→ closed
   │                                                                                                        │
   └────────────────────────────────────────────(任一方断线)─────────────────────────────────────────────────┘ disconnect → finished(判负)
```

- **waiting**：房主创建后等人（快速匹配也会在内部创建 waiting 房间）
- **ready**：人齐，双方有准备状态
- **countdown**：3-2-1 倒计时（服务器统一下发开始时刻，保证双方同时开始）
- **playing**：对战进行中
- **finished**：双方提交/超时/断线，服务器已裁定胜负，写战绩
- **closed**：结果展示完，房间销毁

### 4.2 两条入口

**快速匹配**：

```
玩家 A 点「快速匹配」→ emit 'match:queue'
  → 服务器把 A 放进匹配队列
  → 队列里有人(B)？ → 直接配对 → 建房间 → 双方 emit 'match:found' { roomId, opponent }
  → 队列空？ → A 留在队列里等，30s 未匹配 → emit 'match:timeout'
```

**大厅房间列表**：

```
多人大厅页
├── [快速匹配] 按钮
└── 房间列表（实时刷新）
      ├── 房间A「迅捷猎豹的房间」1/2 [加入]
      ├── 房间B「小红的房间」1/2 [加入]   ← 满了灰掉
      └── ...
      [创建房间] ← 任何人都能开新房

点 [加入] 一个 1/2 的房间 → 直接进去，人齐自动 ready
点 [创建房间] → 自己建房等对手，出现在别人列表里
```

- 服务器维护 `publicRooms` 列表（所有 `waiting` 状态的公开房间）。
- 客户端进大厅 `emit 'lobby:subscribe'`，服务器推送完整列表；新房/房满/房销毁时广播增删给所有订阅者。
- 列表只展示**等人中的房间**（已满 / 进行中的不显示）。

### 4.3 房间交互（准备 / 开始）

- 进房 → 自动 `ready = true`
- 任一方可手动取消准备（再点一下）
- 两人都 `ready = true` → 房主的「开始」按钮亮起
- 房主点开始 → 服务器校验「全员准备 + 是房主」→ 进 countdown

### 4.4 房间数据结构（服务器内存）

```typescript
interface Room {
  roomId: string
  name: string                    // 房主昵称 + "的房间"
  hostId: string
  state: 'waiting' | 'ready' | 'countdown' | 'playing' | 'finished' | 'closed'
  gameMode: 'schulte'
  maxPlayers: 2                   // 参数化，为后续扩到 4/8 留口
  players: Player[]               // [{ id, name, avatar, ready, isHost, connected }]
  createdAt: number
  game: RoomGame | null           // playing/finished 时存在
}

interface PublicRoom {             // 大厅列表展示用，是 Room 的投影
  roomId: string
  name: string
  hostName: string
  playerCount: number
  gameMode: 'schulte'
  state: 'waiting' | 'ready'
}
```

### 4.5 断线处理

- Socket.IO 心跳检测到断线 → 该方判**弃赛负**
- 存活方收到 `room:state { state:'finished', winner:'you' }`
- 写战绩（断线方负，存活方胜）
- **不做断线重连**。若对局已进入 finished（结果已裁定落库），断线不影响结果。

### 4.6 Socket.IO 事件（B 阶段）

| 事件 | 方向 | 载荷 | 说明 |
|---|---|---|---|
| `lobby:subscribe` | C→S | — | 进大厅收房间列表 |
| `lobby:unsubscribe` | C→S | — | 离开大厅 |
| `lobby:list` | S→C | `PublicRoom[]` | 完整列表（订阅时下发） |
| `lobby:roomAdded` | S→C | `PublicRoom` | 新房出现 |
| `lobby:roomChanged` | S→C | `PublicRoom` | 房间信息变化 |
| `lobby:roomRemoved` | S→C | `{ roomId }` | 房间消失 |
| `match:queue` | C→S | — | 加入快速匹配 |
| `match:cancel` | C→S | — | 取消匹配 |
| `match:found` | S→C | `{ roomId, opponent }` | 匹配成功 |
| `match:timeout` | S→C | — | 30s 未匹配上 |
| `room:create` | C→S | `{ name? }` | 创建公开房间 |
| `room:join` | C→S | `{ roomId }` | 加入指定房间 |
| `room:leave` | C→S | — | 主动离开 |
| `player:ready` | C→S | `{ ready: bool }` | 切换准备 |
| `room:start` | C→S | — | 房主点开始 |
| `room:state` | S→C | `{ state, players, ... }` | 房间状态变更广播（waiting/ready/playing/finished 都走这个，前端按 state 分发） |

**核心：所有房间状态变化走一个 `room:state` 事件**，前端按 `state` 字段分发渲染，状态单一来源。

## 5. 舒尔特 PvP（C 阶段）

### 5.1 一局对战时序

```
┌─ 服务器 (countdown 结束) ──────────────────────────────────┐
│  1. 生成同一张舒尔特表（如 5x5，数字 1-25 随机打乱）          │
│  2. 给房间双方 emit 'game:start' {                          │
│       grid: [25 个数字],                                   │
│       startTime: <服务器时间戳>,                           │
│       size: 5,                                            │
│       target: 25                                          │
│     }                                                     │
│  3. 启动房间级计时器（服务器侧，到时间上限强制结算）           │
│  4. 启动进度广播器：每 500ms emit 'game:progress'           │
└───────────────────────────────────────────────────────────┘
        ↓ 双方同时收到同一张表，同时开始

┌─ 客户端 (playing) ──────────────────────────────────────────┐
│  玩家点击格子 N:                                            │
│    - 本地立即反馈（高亮 / 音效，不等服务器）                  │
│    - emit 'game:tap' { cellIndex }                          │
│                                                              │
│  收到 'game:progress' {                                     │
│      me: { found, errors, done },                          │
│      opponent: { found, errors, done }                     │
│    } → 更新自己和对方进度条                                   │
│                                                              │
│  收到 'game:end' { winner, myResult, opponentResult }      │
│    → 显示结果页                                              │
└──────────────────────────────────────────────────────────────┘

┌─ 服务器 (处理 game:tap) ─────────────────────────────────────┐
│  收到玩家 A 的 tap:                                         │
│    1. 查房间该玩家权威进度（服务器内存）                      │
│    2. 校验 cellIndex 是否等于该玩家当前该点的数               │
│       - 对：found++，若 found == target → 该玩家 done         │
│       - 错：errors++                                        │
│    3. 双方都 done 或时间到 → 房间进 finished，裁定胜负        │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 服务器权威进度（内存）

```typescript
interface RoomGame {
  roomId: string
  grid: number[]                   // 权威的表
  startTime: number
  timeLimitMs: number              // 时间上限（如 90000）
  target: number                   // 要点完的总数
  players: {
    [playerId: string]: {
      found: number                // 已正确点数
      errors: number               // 错点次数
      done: boolean                // 是否点完
      finishTime: number | null    // 点完时刻（用于裁定）
    }
  }
  ended: boolean
}
```

客户端本地进度**只用于即时视觉反馈**，服务器进度才是真的。进度广播以服务器为准。

### 5.3 计分规则

**正确率** = `correct / (correct + errors)`

- `correct`：正确点击次数
- `errors`：错误点击次数；**时间到结算时补齐** `(target - correct)`（没点完的格子算错点）
- 例（5x5，target=25，时间上限 90s）：
  - 完美点完：correct=25, errors=0 → 100%
  - 点完错 3 次：correct=25, errors=3 → 89.3%
  - 没点完，对 20 错 2：correct=20, errors=2+5=7 → 74.1%
  - 全没点（弃赛/挂机）：correct=0, errors=0+25=25 → 0%

**胜负裁定顺序**：

1. 正确率高者胜
2. 正确率相同 → 用时短者胜（点完的用 `finishTime`，没点完的用时间上限）
3. 都相同 → 平局

**时间上限**：每局固定（5x5 给 90s，可调）。时间到强制结算，避免无限挂。

**错点代价**：错点拉低正确率（分母 correct+errors 增大），抑制乱点试错行为。

### 5.4 进度广播节流

`game:tap` 会很频繁（玩家点得快时每秒数次）。**服务器不逐次广播 tap**，而是每 500ms 广播一次 `game:progress`，把双方最新 `found/errors/done` 一次性下发。

- 每个房间每秒约 4 次广播（500ms × 双方），4 核服务器撑几十个房间轻松。
- 客户端用 500ms 快照平滑渲染对方进度条；本地自己的进度由 tap 即时更新（不等广播）。

### 5.5 客户端即时反馈

第一版**不要** `game:tapResult`（服务器逐次确认对错）—— 客户端点击后本地立即按「我预期该点的数」判断对错并反馈（高亮 / 音效），不等服务器。服务器只在 `game:progress` 里下发权威 `found/errors`。

若客户端预期与服务器不一致（极少，除非 bug 或作弊），以服务器 500ms 后的广播为准做纠正。这样体验最流畅。

### 5.6 Socket.IO 事件（C 阶段）

| 事件 | 方向 | 载荷 | 说明 |
|---|---|---|---|
| `game:start` | S→C | `{ grid, startTime, size, target, timeLimitMs }` | 服务器生成表并下发，双方同时开始 |
| `game:tap` | C→S | `{ cellIndex }` | 上报点击（expected 由服务器推断，不需客户端传） |
| `game:progress` | S→C | `{ me, opponent }` | 每 500ms 广播双方进度（found/errors/done） |
| `game:end` | S→C | `{ winner, result }` | 胜负裁定，进结果页 |

### 5.7 前端组件

新建 `VersusSchulteBoard`，**不改动现有 `SchulteGrid`**：

- 接收服务器下发的 `grid`（不自己生成）
- 点击时本地高亮 + `emit 'game:tap'`
- 接收 `game:progress` 更新自己和对方进度条
- 不本地算分（计分在服务器）

复用现有舒尔特的视觉样式（颜色、动画、音效）。单人模式零风险。

## 6. 排行榜（D 阶段）

### 6.1 排序规则

**平均正确率榜**（对玩家一句话：「平均正确率高的靠前，相同就看谁平均打得快」）。

1. **上榜门槛**：`matches_played >= 5`（不到 5 局不进榜，但仍可查自己统计）
2. **主排序**：平均正确率 `DESC`
   - 平均正确率 = `total_correct / (total_correct + total_errors)`（总体加权平均，非每局均值的平均，更公平）
3. **次排序**：平均完成时间 `ASC`（`total_time_ms / matches_played`，没点完的局按时间上限计入）
4. **再相同**：平局（按 `created_at` 或 `user_id` 兜底，稳定排序）

### 6.2 数据模型

```sql
-- 每局战绩（房间 finished 时写入）
matches
  id           UUID PK
  room_id      TEXT            -- 仅记录，不外键
  game_mode    TEXT            -- 'schulte'（首版）
  winner_id    UUID NULL       -- 平局为 NULL
  played_at    TIMESTAMPTZ
  players      JSONB           -- [{ userId, name, avatar, correct, errors, accuracy, time_ms, won }]

-- 用户统计（聚合缓存，每局后增量更新，查询 O(1)）
user_stats
  user_id        UUID PK
  matches_played INT DEFAULT 0
  wins           INT DEFAULT 0
  losses         INT DEFAULT 0
  draws          INT DEFAULT 0
  total_correct  INT DEFAULT 0     -- 历史总正确点数
  total_errors   INT DEFAULT 0     -- 历史总错点数（含补齐）
  total_time_ms  BIGINT DEFAULT 0  -- 历史总用时（次排序用）
  updated_at     TIMESTAMPTZ
```

`user_stats` 是 `matches` 的物化缓存。每局结束 Room Engine 增量更新累计值，排行榜查询直接算除法。

### 6.3 REST 接口

| 接口 | 说明 |
|---|---|
| `GET /api/leaderboard?mode=schulte&limit=50` | Top 50 + 自己排名（`myEntry` 即使不在前 50 也返回） |
| `GET /api/me/stats` | 自己的统计（准确率聚合 + 战绩 + 是否已上榜） |

```typescript
interface LeaderboardEntry {
  rank: number
  userId: string
  username: string
  avatar: string
  matchesPlayed: number
  avgAccuracy: number      // 0-100
  avgTimeMs: number
  wins: number
  losses: number
  draws: number
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[]
  myEntry: LeaderboardEntry | null
}
```

战绩写入由 Room Engine 在房间 `finished` 时自动触发，不需要客户端调用。

### 6.4 匿名刷榜（已知限制）

匿名账号可删号重建重置战绩。第一版**不防**：匿名准确率榜本质是「好玩」，不严肃竞技。记为已知限制，未来上正式账号再处理。

## 7. 技术选型与部署

### 7.1 后端栈

- **运行时**：Node.js（与前端同语言，复用 TS 类型）
- **HTTP**：Express（成熟稳定，生态广）
- **实时**：Socket.IO（自带心跳、房间、命名空间、重连机制，省大量造轮子）
- **数据库**：Postgres（SQL 排行榜查询天然适合，事务可靠）
- **DB 访问**：建议用轻量查询构建器（如 `pg` + 手写 SQL，或 `drizzle-orm`），不引入重 ORM
- **语言**：TypeScript（与前端共享类型，如 `PublicRoom` / `LeaderboardEntry`）

### 7.2 部署形态

```
Nginx (已有, 443/80)
  ├── /            → 静态 SPA（现有 dist/，不变）
  ├── /api/*       → 反代到 Node 进程 (localhost:3001)
  └── /socket.io/* → 反代到同一 Node 进程（WebSocket 升级）
```

- Node 进程用 PM2 守护，监听 `localhost:3001`。
- Postgres 装在本机，监听 `localhost:5432`。
- HTTPS 证书复用现有（Nginx 终止 TLS）。
- 环境变量（DB 连接、端口、CORS origin）放 `.env`。

### 7.3 前端新增依赖

- `socket.io-client`：实时连接
- 其余（React / Zustand / Vite / Tailwind）复用现有。

## 8. 前端路由与页面

新增路由（叠加在现有路由上，不动现有页面）：

| 路由 | 页面 | 说明 |
|---|---|---|
| `/versus` | VersusLobby | 多人大厅：快速匹配按钮 + 房间列表 + 创建房间 |
| `/versus/room/:roomId` | VersusRoom | 房间等待/准备/对战/结果页（按 `room:state` 分发） |
| `/leaderboard` | Leaderboard | 排行榜页 |

首页（App.tsx）新增「多人对战」入口卡片，与现有「主线闯关」「自由训练」并列。

## 9. 测试策略

延续项目「spec → plan → implement → test」约定，测试分层：

- **纯逻辑单测**（Vitest，无 IO）：
  - 计分函数（正确率、胜负裁定各种边界）
  - 匹配器队列逻辑
  - 房间状态机迁移合法性
  - 排行榜排序（含门槛、同分兜底）
- **后端集成测试**（supertest + 内存/测试 DB）：
  - Auth 流程（建号、token 校验、重复建号幂等）
  - 战绩写入 → user_stats 增量 → 排行榜查询端到端
- **Socket 集成测试**（socket.io-client 连测试服务器）：
  - 匹配配对 → 进房间 → 双方 ready → 开始 → 双方 tap → 结束 → 战绩落库
  - 断线判负
- **前端组件测试**（RTL，已有 fake-indexeddb 基础设施）：
  - VersusSchulteBoard 收到 grid 后渲染、点击 emit tap、收到 progress 更新进度条
  - 大厅列表订阅/增删渲染
- 复用现有 `tests/setup.ts`（fake-indexeddb、jsdom、jest-dom）。

## 10. 实现顺序建议

按依赖关系，建议分步实现（每步可独立验证）：

1. **后端骨架 + Auth + Postgres**：能建匿名号、token 校验、Socket.IO 连接鉴权通过
2. **Room Engine + 大厅 + 匹配**：能在大厅看到房间、加入、双方 ready、房主开始进 countdown（但 countdown 后什么都不做）
3. **舒尔特对战（C 阶段）**：countdown 后生成表、双方 tap、进度广播、裁定胜负
4. **战绩 + 排行榜（D 阶段）**：finished 时写库、排行榜页可查
5. **前端大厅 + 对战页 + 排行榜页 UI 串联**

每步交付可玩的最小闭环，而不是一次性铺开所有代码。

## 11. 未决 / 后续

- **断线重连**：本阶段不做，未来需要时恢复房间状态 + 游戏中间态。
- **多游戏 PvP**：序列记忆、Stroop 的 PvP 适配（暗瓶不适合竞速，可能不做）。
- **ELO/段位匹配**：等有足够对局数据后，从「先到先打」升级。
- **4–8 人房间**：架构已参数化 `MAX_PLAYERS`，但需设计多人进度同步与排名展示。
- **正式账号 / 防刷榜**：上邮箱密码或 OAuth 后，排行榜分匿名/正式两层。
- **观战**：房间支持旁观者角色（架构上 Socket.IO room 已支持，产品层未做）。
