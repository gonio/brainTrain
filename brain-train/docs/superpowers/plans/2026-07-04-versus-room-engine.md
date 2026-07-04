# 多人对战 - 计划二：Room Engine + 大厅 + 匹配

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在计划一的鉴权地基上，实现房间系统：大厅房间列表、创建/加入房间、准备/开始、countdown 倒计时。完成后两个已认证的客户端能在大厅看到房间、加入、双方准备、房主点开始、进入 3-2-1 倒计时（倒计时结束不接游戏逻辑，留给计划三）。

**Architecture:** Room Engine 是纯内存态房间状态机（不进 DB），注册在 Socket.IO server 上。鉴权中间件（计划一）已给每个 socket 挂了 `userId`/`userName`，Room Engine 直接用。模块拆分：`roomStore`（房间数据 + 增删查纯逻辑）、`roomStateMachine`（状态迁移合法性纯函数）、`lobbyService`（大厅订阅 + 广播）、`matchService`（匹配队列）、`roomHandlers`（Socket.IO 事件入口）。

**Tech Stack:** Node 20, TypeScript, Socket.IO 4, Vitest（纯逻辑单测 + Socket.IO 集成测试复用计划一的 testServer helper）。

**Spec:** `brain-train/docs/superpowers/specs/2026-07-04-multiplayer-versus-design.md`（第 4 章）

---

## 范围边界

**本计划做：** 大厅列表、创建/加入/离开房间、准备切换、房主开始校验、countdown 倒计时、断线判负（房间层）、快速匹配队列。

**本计划不做（留给后续）：**
- countdown 结束后的 `game:start`（舒尔特表生成、计分、进度广播）→ 计划三
- 战绩写入 / 排行榜 → 计划四
- 前端 UI → 计划五（本计划只写后端 + 集成测试，前端对接靠事件契约）
- 断线重连

**countdown 结束的行为（计划二的占位）：** countdown 倒数到 0 后，房间直接回到 `ready` 状态并广播 `room:state`（不进 playing）。这样计划二是一个自洽闭环：能完整测大厅→房间→准备→开始→倒计时→回 ready，不依赖游戏逻辑。计划三接手时，把"回到 ready"换成"进 playing + game:start"。

---

## 文件结构总览

### 新增后端文件（`server/src/`）

| 文件 | 职责 |
|---|---|
| `src/types/room.ts` | 房间领域类型：`Room`、`Player`、`PublicRoom`、`RoomState`、事件载荷类型 |
| `src/rooms/roomStateMachine.ts` | 纯函数：状态迁移合法性（waiting↔ready、ready→countdown 等） |
| `src/rooms/roomStore.ts` | 房间数据存储（内存 Map）：create/get/findPublic/remove + 增删改 |
| `src/rooms/roomHelpers.ts` | 纯函数：`toPublicRoom`（Room→PublicRoom 投影）、`allReady`、`isFull`、房间命名 |
| `src/rooms/lobbyService.ts` | 大厅：管理订阅者集合、计算 publicRooms 列表、广播增删改 |
| `src/rooms/matchService.ts` | 匹配队列：入队/出队/配对/超时 |
| `src/rooms/roomHandlers.ts` | Socket.IO 事件入口：注册所有 B 阶段事件处理器，协调上述模块 |
| `src/rooms/index.ts` | barrel：导出 `attachRoomHandlers(io)` |

### 改动后端文件

| 文件 | 改动 |
|---|---|
| `src/app.ts` | 在 `attachAuthMiddleware(io)` 后调用 `attachRoomHandlers(io)` |
| `src/realtime/socketAuth.ts` | socket 已有 `userId`/`userName`，无改动（确认 avatar 也能取到——见 Task 1 注） |

### 新增测试文件（`server/tests/`）

| 文件 | 覆盖 |
|---|---|
| `tests/roomStateMachine.test.ts` | 状态迁移合法性全边界 |
| `tests/roomHelpers.test.ts` | toPublicRoom/allReady/isFull/命名 |
| `tests/roomStore.test.ts` | 增删查、public 列表过滤 |
| `tests/lobbyService.test.ts` | 订阅/广播（用 mock socket） |
| `tests/matchService.test.ts` | 队列入队/配对/超时 |
| `tests/roomHandlers.test.ts` | Socket.IO 集成测试：建房→加入→准备→开始→countdown 全流程 + 断线 |

---

## 任务依赖图

```
Task 1 (类型) ─┬─→ Task 2 (stateMachine) [TDD]
               ├─→ Task 3 (helpers) [TDD]
               └─→ Task 4 (roomStore) [TDD]
                              │
Task 5 (lobbyService) [TDD] ──┤
Task 6 (matchService) [TDD] ──┤
                              ↓
Task 7 (roomHandlers) ──→ Task 8 (接入 app.ts + 集成测试)
                              ↓
Task 9 (端到端冒烟 + 服务器部署)
```

Task 1 是所有模块的类型基础。Task 2/3/4 互相独立（都只依赖 Task 1）。Task 5/6 依赖 store/helpers。Task 7 依赖 1-6。Task 8 接入 + 集成测试。Task 9 服务器验证。

---

## Task 1: 房间领域类型

**Files:**
- Create: `server/src/types/room.ts`

- [ ] **Step 1: 创建 `server/src/types/room.ts`**

```typescript
// 房间领域类型（B 阶段：Room Engine + 大厅 + 匹配）

// 房间状态机
export type RoomState =
  | 'waiting'      // 房主创建后等人
  | 'ready'        // 人齐，双方有准备状态
  | 'countdown'    // 3-2-1 倒计时
  | 'playing'      // 对战进行中（计划三启用）
  | 'finished'     // 结果已裁定（计划三启用）
  | 'closed';      // 房间销毁

// 游戏模式（首版只有舒尔特，字段为后续扩展留口）
export type GameMode = 'schulte';

// 房间内玩家
export interface Player {
  id: string;        // = socket.userId
  socketId: string;  // 当前连接的 socket.id
  name: string;      // 用户名
  avatar: string;    // emoji 头像
  ready: boolean;    // 准备状态
  isHost: boolean;   // 是否房主
  connected: boolean; // 当前是否在线（断线标记）
}

// 房间（服务器内存态）
export interface Room {
  roomId: string;
  name: string;        // 房主昵称 + "的房间"
  hostId: string;      // 房主 userId
  state: RoomState;
  gameMode: GameMode;
  maxPlayers: number;  // 参数化，为后续扩到 4/8 留口（首版 2）
  players: Player[];
  createdAt: number;
}

// 大厅列表展示用（Room 的投影，去敏感字段）
export interface PublicRoom {
  roomId: string;
  name: string;
  hostName: string;
  playerCount: number;
  gameMode: GameMode;
  state: 'waiting' | 'ready';  // 只列等人中的房间
}

// ============ Socket.IO 事件载荷类型 ============

// S→C: room:state 广播给房间内所有人
export interface RoomStatePayload {
  roomId: string;
  name: string;
  state: RoomState;
  players: Player[];
  gameMode: GameMode;
}

// S→C: match:found
export interface MatchFoundPayload {
  roomId: string;
  opponent: { id: string; name: string; avatar: string };
}

// S→C: lobby:list / lobby:roomAdded / lobby:roomChanged
// lobby:list 用 PublicRoom[]，其余用单个 PublicRoom

// C→S: room:create
export interface RoomCreateInput {
  name?: string;
}

// C→S: room:join
export interface RoomJoinInput {
  roomId: string;
}

// C→S: player:ready
export interface PlayerReadyInput {
  ready: boolean;
}
```

- [ ] **Step 2: 确认 socketAuth 能提供 avatar**

读 `server/src/realtime/socketAuth.ts`，确认 `findUserByToken` 返回的 user 是否带 avatar。当前 socketAuth 只挂了 `userId`/`userName`，**Room Engine 还需要 avatar**。

如果 socketAuth 没存 avatar，扩展它（在同一文件）：在挂载 userId/userName 时一并存 `socket.userAvatar = user.avatar`。这需要更新 `declare module 'socket.io'` 的 Socket 接口加 `userAvatar?: string`。

具体改动（在 socketAuth.ts 里）：
- Socket 接口声明加 `userAvatar?: string`
- 中间件里 `socket.userAvatar = user.avatar`

- [ ] **Step 3: Commit**

```bash
cd D:\BrainTrain
git add server/src/types/room.ts server/src/realtime/socketAuth.ts
git commit -m "feat(rooms): 房间领域类型 + socketAuth 补 avatar"
```

---

## Task 2: roomStateMachine（纯逻辑 TDD）

**Files:**
- Test: `server/tests/roomStateMachine.test.ts`
- Create: `server/src/rooms/roomStateMachine.ts`

纯函数，校验状态迁移合法性。无 IO，测试不依赖 DB。

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, it, expect } from 'vitest';
import { canTransition, nextWaitingState } from '../src/rooms/roomStateMachine.js';
import type { Room } from '../src/types/room.js';

describe('roomStateMachine', () => {
  describe('canTransition', () => {
    it('waiting → ready 合法（第二人加入）', () => {
      expect(canTransition('waiting', 'ready')).toBe(true);
    });

    it('ready → waiting 合法（有人离开）', () => {
      expect(canTransition('ready', 'waiting')).toBe(true);
    });

    it('ready → countdown 合法（房主开始）', () => {
      expect(canTransition('ready', 'countdown')).toBe(true);
    });

    it('countdown → ready 合法（计划二占位：倒计时结束回 ready）', () => {
      expect(canTransition('countdown', 'ready')).toBe(true);
    });

    it('countdown → playing 合法（计划三会启用）', () => {
      expect(canTransition('countdown', 'playing')).toBe(true);
    });

    it('playing → finished 合法', () => {
      expect(canTransition('playing', 'finished')).toBe(true);
    });

    it('任意 → closed 合法（销毁）', () => {
      expect(canTransition('waiting', 'closed')).toBe(true);
      expect(canTransition('playing', 'closed')).toBe(true);
      expect(canTransition('finished', 'closed')).toBe(true);
    });

    it('waiting → playing 非法（必须经 ready/countdown）', () => {
      expect(canTransition('waiting', 'playing')).toBe(false);
    });

    it('playing → waiting 非法（不能从对战跳回等人）', () => {
      expect(canTransition('playing', 'waiting')).toBe(false);
    });

    it('closed → 任意 非法（终态）', () => {
      expect(canTransition('closed', 'waiting')).toBe(false);
      expect(canTransition('closed', 'ready')).toBe(false);
    });
  });

  describe('nextWaitingState', () => {
    // 给定房间，根据人数返回应处的状态：没人/1人→waiting，2人→ready
    const baseRoom = (playerCount: number): Room => ({
      roomId: 'r1', name: '测试房', hostId: 'h1',
      state: 'waiting', gameMode: 'schulte', maxPlayers: 2,
      createdAt: 0,
      players: Array.from({ length: playerCount }, (_, i) => ({
        id: `p${i}`, socketId: `s${i}`, name: `玩家${i}`,
        avatar: '🦊', ready: playerCount === 2, isHost: i === 0, connected: true,
      })),
    });

    it('1 人 → waiting', () => {
      expect(nextWaitingState(baseRoom(1))).toBe('waiting');
    });

    it('2 人 → ready', () => {
      expect(nextWaitingState(baseRoom(2))).toBe('ready');
    });

    it('0 人 → waiting', () => {
      expect(nextWaitingState(baseRoom(0))).toBe('waiting');
    });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd D:\BrainTrain\server && npx vitest run tests/roomStateMachine.test.ts`
Expected: FAIL — 模块找不到。

- [ ] **Step 3: 实现 `server/src/rooms/roomStateMachine.ts`**

```typescript
// 房间状态机：纯函数，校验状态迁移合法性。无副作用。
import type { RoomState, Room } from '../types/room.js';

// 合法的状态迁移边
const TRANSITIONS: Record<RoomState, RoomState[]> = {
  waiting: ['ready', 'closed'],
  ready: ['waiting', 'countdown', 'closed'],
  countdown: ['ready', 'playing', 'closed'],
  playing: ['finished', 'closed'],
  finished: ['closed'],
  closed: [],
};

// 校验 fromState → toState 是否合法
export function canTransition(from: RoomState, to: RoomState): boolean {
  return TRANSITIONS[from].includes(to);
}

// 根据房间人数推断应处的"等人类"状态：
// 没人或1人 → waiting；人齐 → ready
export function nextWaitingState(room: Room): 'waiting' | 'ready' {
  return room.players.length >= room.maxPlayers ? 'ready' : 'waiting';
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd D:\BrainTrain\server && npx vitest run tests/roomStateMachine.test.ts`
Expected: PASS（全绿）。

- [ ] **Step 5: Commit**

```bash
git add server/src/rooms/roomStateMachine.ts server/tests/roomStateMachine.test.ts
git commit -m "feat(rooms): 房间状态机纯函数（迁移合法性）"
```

---

## Task 3: roomHelpers（纯逻辑 TDD）

**Files:**
- Test: `server/tests/roomHelpers.test.ts`
- Create: `server/src/rooms/roomHelpers.ts`

纯函数：投影、判断满员/全准备、命名。

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, it, expect } from 'vitest';
import { toPublicRoom, isFull, allReady, makeRoomName, toRoomStatePayload } from '../src/rooms/roomHelpers.js';
import type { Room } from '../src/types/room.js';

const makeRoom = (overrides: Partial<Room> = {}): Room => ({
  roomId: 'r1',
  name: '测试房',
  hostId: 'h1',
  state: 'waiting',
  gameMode: 'schulte',
  maxPlayers: 2,
  createdAt: 1000,
  players: [
    { id: 'h1', socketId: 's1', name: '房主', avatar: '🦊', ready: true, isHost: true, connected: true },
  ],
  ...overrides,
});

describe('roomHelpers', () => {
  describe('toPublicRoom', () => {
    it('把 Room 投影成 PublicRoom，只保留展示字段', () => {
      const room = makeRoom();
      const pub = toPublicRoom(room);
      expect(pub).toEqual({
        roomId: 'r1',
        name: '测试房',
        hostName: '房主',
        playerCount: 1,
        gameMode: 'schulte',
        state: 'waiting',
      });
    });

    it('playing/finished 状态的房间投影 state 仍是 waiting/ready（不进列表的由调用方过滤）', () => {
      // 注意：toPublicRoom 只做字段裁剪，是否进列表由 lobbyService 按 state 过滤
      const room = makeRoom({ state: 'playing' });
      // state 字段类型是 'waiting' | 'ready'，playing 房间不应该被投影
      // → toPublicRoom 对非 waiting/ready 状态返回 null
      expect(toPublicRoom(room)).toBeNull();
    });
  });

  describe('isFull', () => {
    it('人数 < maxPlayers → false', () => {
      expect(isFull(makeRoom({ players: [
        { id: 'a', socketId: 's', name: 'a', avatar: '🦊', ready: true, isHost: true, connected: true },
      ] }))).toBe(false);
    });

    it('人数 == maxPlayers → true', () => {
      expect(isFull(makeRoom({ players: [
        { id: 'a', socketId: 's1', name: 'a', avatar: '🦊', ready: true, isHost: true, connected: true },
        { id: 'b', socketId: 's2', name: 'b', avatar: '🐰', ready: true, isHost: false, connected: true },
      ] }))).toBe(true);
    });
  });

  describe('allReady', () => {
    it('所有玩家 ready=true → true', () => {
      expect(allReady(makeRoom({ players: [
        { id: 'a', socketId: 's1', name: 'a', avatar: '🦊', ready: true, isHost: true, connected: true },
        { id: 'b', socketId: 's2', name: 'b', avatar: '🐰', ready: true, isHost: false, connected: true },
      ] }))).toBe(true);
    });

    it('任一玩家 ready=false → false', () => {
      expect(allReady(makeRoom({ players: [
        { id: 'a', socketId: 's1', name: 'a', avatar: '🦊', ready: true, isHost: true, connected: true },
        { id: 'b', socketId: 's2', name: 'b', avatar: '🐰', ready: false, isHost: false, connected: true },
      ] }))).toBe(false);
    });

    it('空房间 → true（无人未准备，视为满足）', () => {
      expect(allReady(makeRoom({ players: [] }))).toBe(true);
    });
  });

  describe('makeRoomName', () => {
    it('房主昵称 + "的房间"', () => {
      expect(makeRoomName('迅捷猎豹#3F7K')).toBe('迅捷猎豹#3F7K的房间');
    });
  });

  describe('toRoomStatePayload', () => {
    it('转成广播载荷', () => {
      const room = makeRoom();
      const payload = toRoomStatePayload(room);
      expect(payload).toEqual({
        roomId: 'r1',
        name: '测试房',
        state: 'waiting',
        players: room.players,
        gameMode: 'schulte',
      });
    });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd D:\BrainTrain\server && npx vitest run tests/roomHelpers.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现 `server/src/rooms/roomHelpers.ts`**

```typescript
// 房间纯函数：投影、判断满员/全准备、命名。无副作用。
import type { Room, PublicRoom, RoomState, Player, RoomStatePayload, GameMode } from '../types/room.js';

// Room → PublicRoom 投影。非 waiting/ready 状态返回 null（不进大厅列表）。
export function toPublicRoom(room: Room): PublicRoom | null {
  if (room.state !== 'waiting' && room.state !== 'ready') return null;

  const host = room.players.find((p) => p.isHost);
  return {
    roomId: room.roomId,
    name: room.name,
    hostName: host?.name ?? '未知',
    playerCount: room.players.length,
    gameMode: room.gameMode,
    state: room.state,
  };
}

// 房间是否满员
export function isFull(room: Room): boolean {
  return room.players.length >= room.maxPlayers;
}

// 所有玩家是否都准备
export function allReady(room: Room): boolean {
  return room.players.every((p) => p.ready);
}

// 房间命名：房主昵称 + "的房间"
export function makeRoomName(hostName: string): string {
  return `${hostName}的房间`;
}

// Room → 广播载荷
export function toRoomStatePayload(room: Room): RoomStatePayload {
  return {
    roomId: room.roomId,
    name: room.name,
    state: room.state,
    players: room.players,
    gameMode: room.gameMode,
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd D:\BrainTrain\server && npx vitest run tests/roomHelpers.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add server/src/rooms/roomHelpers.ts server/tests/roomHelpers.test.ts
git commit -m "feat(rooms): 房间纯函数（投影/满员/全准备/命名）"
```

---

## Task 4: roomStore（内存存储 TDD）

**Files:**
- Test: `server/tests/roomStore.test.ts`
- Create: `server/src/rooms/roomStore.ts`

房间数据存储（内存 Map），不依赖 DB。

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createRoomStore } from '../src/rooms/roomStore.js';
import type { Player } from '../src/types/room.js';

const player = (id: string, isHost = false): Player => ({
  id, socketId: `s-${id}`, name: `玩家${id}`, avatar: '🦊',
  ready: true, isHost, connected: true,
});

describe('roomStore', () => {
  let store: ReturnType<typeof createRoomStore>;

  beforeEach(() => {
    store = createRoomStore();
  });

  it('create 建房并返回 room', () => {
    const room = store.create('h1', player('h1', true));
    expect(room.roomId).toBeTruthy();
    expect(room.hostId).toBe('h1');
    expect(room.state).toBe('waiting');
    expect(room.players).toHaveLength(1);
    expect(room.maxPlayers).toBe(2);
  });

  it('get 按 roomId 查', () => {
    const created = store.create('h1', player('h1', true));
    expect(store.get(created.roomId)?.roomId).toBe(created.roomId);
  });

  it('get 不存在返回 null', () => {
    expect(store.get('不存在')).toBeNull();
  });

  it('findByPlayerId 按 userId 查房间', () => {
    const created = store.create('h1', player('h1', true));
    expect(store.findByPlayerId('h1')?.roomId).toBe(created.roomId);
  });

  it('findPublic 返回所有 waiting/ready 房间的投影', () => {
    store.create('h1', player('h1', true));
    store.create('h2', player('h2', true));
    const pubs = store.findPublic();
    expect(pubs).toHaveLength(2);
    pubs.forEach((p) => {
      expect(p.state).toMatch(/waiting|ready/);
    });
  });

  it('findPublic 不返回 playing/finished 房间', () => {
    const r = store.create('h1', player('h1', true));
    // 手动改成 playing
    store.update(r.roomId, (room) => { room.state = 'playing'; });
    expect(store.findPublic()).toHaveLength(0);
  });

  it('update 更新房间（返回更新后的 room）', () => {
    const r = store.create('h1', player('h1', true));
    const updated = store.update(r.roomId, (room) => {
      room.state = 'ready';
    });
    expect(updated?.state).toBe('ready');
    expect(store.get(r.roomId)?.state).toBe('ready');
  });

  it('update 不存在返回 null', () => {
    expect(store.update('不存在', () => {})).toBeNull();
  });

  it('remove 删除房间', () => {
    const r = store.create('h1', player('h1', true));
    store.remove(r.roomId);
    expect(store.get(r.roomId)).toBeNull();
  });

  it('count 统计房间数', () => {
    expect(store.count()).toBe(0);
    store.create('h1', player('h1', true));
    expect(store.count()).toBe(1);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd D:\BrainTrain\server && npx vitest run tests/roomStore.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现 `server/src/rooms/roomStore.ts`**

```typescript
// 房间内存存储：Map<roomId, Room>。不进 DB，进程重启即清空。
import { randomUUID } from 'node:crypto';
import type { Room, Player, PublicRoom, GameMode } from '../types/room.js';
import { toPublicRoom } from './roomHelpers.js';

export interface RoomStore {
  create(hostId: string, host: Player, opts?: { name?: string; gameMode?: GameMode; maxPlayers?: number }): Room;
  get(roomId: string): Room | null;
  findByPlayerId(userId: string): Room | null;
  findPublic(): PublicRoom[];
  update(roomId: string, mutator: (room: Room) => void): Room | null;
  remove(roomId: string): void;
  count(): number;
}

export function createRoomStore(): RoomStore {
  const rooms = new Map<string, Room>();

  return {
    create(hostId, host, opts = {}) {
      const roomId = randomUUID();
      const room: Room = {
        roomId,
        name: opts.name ?? `${host.name}的房间`,
        hostId,
        state: 'waiting',
        gameMode: opts.gameMode ?? 'schulte',
        maxPlayers: opts.maxPlayers ?? 2,
        players: [host],
        createdAt: Date.now(),
      };
      rooms.set(roomId, room);
      return room;
    },

    get(roomId) {
      return rooms.get(roomId) ?? null;
    },

    findByPlayerId(userId) {
      for (const room of rooms.values()) {
        if (room.players.some((p) => p.id === userId)) return room;
      }
      return null;
    },

    findPublic() {
      const pubs: PublicRoom[] = [];
      for (const room of rooms.values()) {
        const pub = toPublicRoom(room);
        if (pub) pubs.push(pub);
      }
      return pubs;
    },

    update(roomId, mutator) {
      const room = rooms.get(roomId);
      if (!room) return null;
      mutator(room);
      return room;
    },

    remove(roomId) {
      rooms.delete(roomId);
    },

    count() {
      return rooms.size;
    },
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd D:\BrainTrain\server && npx vitest run tests/roomStore.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add server/src/rooms/roomStore.ts server/tests/roomStore.test.ts
git commit -m "feat(rooms): 房间内存存储（增删查改 + public 列表）"
```

---

## Task 5: lobbyService（大厅订阅 TDD）

**Files:**
- Test: `server/tests/lobbyService.test.ts`
- Create: `server/src/rooms/lobbyService.ts`

管理订阅者集合，封装广播。用极简的依赖注入（接收一个 `emit` 回调）避免直接依赖 socket.io，便于单测。

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLobbyService } from '../src/rooms/lobbyService.js';
import type { PublicRoom } from '../src/types/room.js';

const pub = (id: string, name = `房${id}`, count = 1): PublicRoom => ({
  roomId: id, name, hostName: `房主${id}`, playerCount: count, gameMode: 'schulte', state: 'waiting',
});

describe('lobbyService', () => {
  let lobby: ReturnType<typeof createLobbyService>;
  let emit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    emit = vi.fn();
    lobby = createLobbyService(emit);
  });

  describe('订阅', () => {
    it('subscribe 注册订阅者', () => {
      lobby.subscribe('sock1', [pub('r1')]);
      expect(emit).toHaveBeenCalledWith('sock1', 'lobby:list', [pub('r1')]);
    });

    it('unsubscribe 移除订阅者（之后不再收广播）', () => {
      lobby.subscribe('sock1', []);
      lobby.unsubscribe('sock1');
      lobby.broadcastRoomAdded(pub('r2'));
      expect(emit).not.toHaveBeenCalledWith('sock1', 'lobby:roomAdded', expect.anything());
    });

    it('重复 subscribe 不重复（幂等）', () => {
      lobby.subscribe('sock1', []);
      lobby.subscribe('sock1', []);
      // 第二次仍下发 list（重新订阅刷新），但订阅集合不重复
      lobby.broadcastRoomAdded(pub('r2'));
      expect(emit).toHaveBeenCalledTimes(3); // 2 次 list + 1 次 roomAdded
    });
  });

  describe('广播增删改', () => {
    beforeEach(() => {
      lobby.subscribe('sock1', []);
      lobby.subscribe('sock2', []);
      emit.mockClear();
    });

    it('broadcastRoomAdded 通知所有订阅者', () => {
      lobby.broadcastRoomAdded(pub('r1'));
      expect(emit).toHaveBeenCalledWith('sock1', 'lobby:roomAdded', pub('r1'));
      expect(emit).toHaveBeenCalledWith('sock2', 'lobby:roomAdded', pub('r1'));
    });

    it('broadcastRoomChanged 通知所有订阅者', () => {
      const changed = { ...pub('r1'), playerCount: 2, state: 'ready' as const };
      lobby.broadcastRoomChanged(changed);
      expect(emit).toHaveBeenCalledWith('sock1', 'lobby:roomChanged', changed);
      expect(emit).toHaveBeenCalledWith('sock2', 'lobby:roomChanged', changed);
    });

    it('broadcastRoomRemoved 通知所有订阅者', () => {
      lobby.broadcastRoomRemoved('r1');
      expect(emit).toHaveBeenCalledWith('sock1', 'lobby:roomRemoved', { roomId: 'r1' });
      expect(emit).toHaveBeenCalledWith('sock2', 'lobby:roomRemoved', { roomId: 'r1' });
    });

    it('没有订阅者时不调用 emit', () => {
      const emptyLobby = createLobbyService(emit);
      emptyLobby.broadcastRoomAdded(pub('r1'));
      // emit 不应被调用（除了 subscribe 时的 list，这里没 subscribe）
      expect(emit).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd D:\BrainTrain\server && npx vitest run tests/lobbyService.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现 `server/src/rooms/lobbyService.ts`**

```typescript
// 大厅服务：管理订阅者集合 + 封装广播。通过注入的 emit 回调发送，便于单测。
import type { PublicRoom } from '../types/room.js';

// emit 回调签名：(socketId, event, payload) => void
export type EmitFn = (socketId: string, event: string, payload: unknown) => void;

export interface LobbyService {
  subscribe(socketId: string, currentList: PublicRoom[]): void;
  unsubscribe(socketId: string): void;
  broadcastRoomAdded(room: PublicRoom): void;
  broadcastRoomChanged(room: PublicRoom): void;
  broadcastRoomRemoved(roomId: string): void;
}

export function createLobbyService(emit: EmitFn): LobbyService {
  const subscribers = new Set<string>();

  return {
    subscribe(socketId, currentList) {
      subscribers.add(socketId);
      emit(socketId, 'lobby:list', currentList);
    },

    unsubscribe(socketId) {
      subscribers.delete(socketId);
    },

    broadcastRoomAdded(room) {
      for (const sid of subscribers) {
        emit(sid, 'lobby:roomAdded', room);
      }
    },

    broadcastRoomChanged(room) {
      for (const sid of subscribers) {
        emit(sid, 'lobby:roomChanged', room);
      }
    },

    broadcastRoomRemoved(roomId) {
      for (const sid of subscribers) {
        emit(sid, 'lobby:roomRemoved', { roomId });
      }
    },
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd D:\BrainTrain\server && npx vitest run tests/lobbyService.test.ts`
Expected: PASS。

注意：Task 1 测试里"重复 subscribe"那条 expect `toHaveBeenCalledTimes(3)`——2 次 subscribe 各发一次 list（2 次），加 1 次 roomAdded = 3 次。如果实现让第二次 subscribe 不发 list，调整测试预期为 2。以实现为准：subscribe 每次都发 list（刷新语义）。确认测试和实现一致。

- [ ] **Step 5: Commit**

```bash
git add server/src/rooms/lobbyService.ts server/tests/lobbyService.test.ts
git commit -m "feat(rooms): 大厅订阅服务（订阅/广播增删改）"
```

---

## Task 6: matchService（匹配队列 TDD）

**Files:**
- Test: `server/tests/matchService.test.ts`
- Create: `server/src/rooms/matchService.ts`

匹配队列：先到先打。入队/出队/配对。用 fake timers 测超时。

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createMatchService } from '../src/rooms/matchService.js';
import type { Player } from '../src/types/room.js';

const player = (id: string): Player => ({
  id, socketId: `s-${id}`, name: `玩家${id}`, avatar: '🦊',
  ready: true, isHost: true, connected: true,
});

describe('matchService', () => {
  let match: ReturnType<typeof createMatchService>;
  let onMatched: ReturnType<typeof vi.fn>;
  let onTimeout: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    onMatched = vi.fn();
    onTimeout = vi.fn();
    match = createMatchService({ onMatched, onTimeout, timeoutMs: 30000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('第一个入队：不立即配对，等待', () => {
    match.enqueue('p1', player('p1'));
    expect(onMatched).not.toHaveBeenCalled();
  });

  it('第二个入队：立即配对，触发 onMatched（含两人信息）', () => {
    match.enqueue('p1', player('p1'));
    match.enqueue('p2', player('p2'));
    expect(onMatched).toHaveBeenCalledTimes(1);
    const [a, b] = onMatched.mock.calls[0];
    expect([a.id, b.id].sort()).toEqual(['p1', 'p2']);
  });

  it('配对后双方都出队', () => {
    match.enqueue('p1', player('p1'));
    match.enqueue('p2', player('p2'));
    // 再入队第三人不应触发配对（队列已空）
    match.enqueue('p3', player('p3'));
    expect(onMatched).toHaveBeenCalledTimes(1);
  });

  it('cancel 把玩家移出队列', () => {
    match.enqueue('p1', player('p1'));
    match.cancel('p1');
    match.enqueue('p2', player('p2'));
    // p1 已取消，p2 入队后无人可配
    expect(onMatched).not.toHaveBeenCalled();
  });

  it('cancel 不存在的玩家：无副作用', () => {
    expect(() => match.cancel('不存在')).not.toThrow();
  });

  it('超时：30s 后触发 onTimeout', () => {
    match.enqueue('p1', player('p1'));
    vi.advanceTimersByTime(30000);
    expect(onTimeout).toHaveBeenCalledWith('p1');
  });

  it('配对成功后清除超时定时器（不再触发 onTimeout）', () => {
    match.enqueue('p1', player('p1'));
    match.enqueue('p2', player('p2'));
    vi.advanceTimersByTime(30000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('cancel 后清除超时定时器', () => {
    match.enqueue('p1', player('p1'));
    match.cancel('p1');
    vi.advanceTimersByTime(30000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('已在队列中再次 enqueue：不重复（幂等）', () => {
    match.enqueue('p1', player('p1'));
    match.enqueue('p1', player('p1'));
    // 仍是 1 人在队列，配对不会触发
    match.enqueue('p2', player('p2'));
    expect(onMatched).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd D:\BrainTrain\server && npx vitest run tests/matchService.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现 `server/src/rooms/matchService.ts`**

```typescript
// 匹配队列：先到先打。第二个入队者立即与第一个配对。
import type { Player } from '../types/room.js';

export interface MatchCallbacks {
  onMatched: (a: Player, b: Player) => void;
  onTimeout: (userId: string) => void;
}

export interface MatchService {
  enqueue(userId: string, player: Player): void;
  cancel(userId: string): void;
}

export function createMatchService(
  cb: MatchCallbacks,
  opts: { timeoutMs?: number } = {},
): MatchService {
  const timeoutMs = opts.timeoutMs ?? 30000;
  // 队列：按入队顺序排
  const queue: { userId: string; player: Player }[] = [];
  const timers = new Map<string, NodeJS.Timeout>();

  function clearTimer(userId: string): void {
    const t = timers.get(userId);
    if (t) {
      clearTimeout(t);
      timers.delete(userId);
    }
  }

  function startTimer(userId: string): void {
    const t = setTimeout(() => {
      // 超时：从队列移除并通知
      removeFromQueue(userId);
      clearTimer(userId);
      cb.onTimeout(userId);
    }, timeoutMs);
    timers.set(userId, t);
  }

  function removeFromQueue(userId: string): void {
    const idx = queue.findIndex((e) => e.userId === userId);
    if (idx >= 0) queue.splice(idx, 1);
  }

  function tryMatch(): void {
    while (queue.length >= 2) {
      const a = queue.shift()!;
      const b = queue.shift()!;
      clearTimer(a.userId);
      clearTimer(b.userId);
      cb.onMatched(a.player, b.player);
    }
  }

  return {
    enqueue(userId, player) {
      // 幂等：已在队列则忽略
      if (queue.some((e) => e.userId === userId)) return;
      queue.push({ userId, player });
      startTimer(userId);
      tryMatch();
    },

    cancel(userId) {
      removeFromQueue(userId);
      clearTimer(userId);
    },
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd D:\BrainTrain\server && npx vitest run tests/matchService.test.ts`
Expected: PASS（注意 fake timers 配合，全绿）。

- [ ] **Step 5: Commit**

```bash
git add server/src/rooms/matchService.ts server/tests/matchService.test.ts
git commit -m "feat(rooms): 快速匹配队列（先到先打 + 超时）"
```

---

## Task 7: roomHandlers（Socket.IO 事件编排）

**Files:**
- Create: `server/src/rooms/roomHandlers.ts`
- Create: `server/src/rooms/index.ts`

把前面所有模块组装到 Socket.IO 事件处理器里。这是协调层，依赖 1-6 的所有模块。

- [ ] **Step 1: 实现 `server/src/rooms/roomHandlers.ts`**

这个文件不写独立单测（逻辑都在前面模块里测过了），它的正确性由 Task 8 的集成测试覆盖。

```typescript
// 房间事件编排：注册所有 B 阶段 Socket.IO 事件处理器。
// 协调 roomStore / lobbyService / matchService，依赖 socketAuth 挂的 userId/userName/userAvatar。
import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { Player } from '../types/room.js';
import { createRoomStore } from './roomStore.js';
import { createLobbyService } from './lobbyService.js';
import { createMatchService } from './matchService.js';
import { canTransition, nextWaitingState } from './roomStateMachine.js';
import { toPublicRoom, isFull, allReady, toRoomStatePayload, makeRoomName } from './roomHelpers.js';

// countdown 倒计时秒数（计划二占位：结束后回 ready）
const COUNTDOWN_SECONDS = 3;

export function attachRoomHandlers(io: SocketIOServer): void {
  const store = createRoomStore();
  const lobby = createLobbyService((socketId, event, payload) => {
    io.to(socketId).emit(event, payload);
  });
  const match = createMatchService({
    onMatched: (a, b) => {
      // 配对成功：建房间，两人加入，进 ready
      const host = { ...a, isHost: true };
      const guest = { ...b, isHost: false };
      // 第二人加入时 ready 自动 true（spec 4.3）
      const room = store.create(a.id, host);
      room.players.push(guest);
      room.state = nextWaitingState(room);
      joinSocketToRoom(io, a.socketId, room.roomId);
      joinSocketToRoom(io, b.socketId, room.roomId);
      broadcastRoomState(io, room);
      // 通知双方匹配成功（携带对手信息）
      io.to(a.socketId).emit('match:found', { roomId: room.roomId, opponent: { id: b.id, name: b.name, avatar: b.avatar } });
      io.to(b.socketId).emit('match:found', { roomId: room.roomId, opponent: { id: a.id, name: a.name, avatar: a.avatar } });
    },
    onTimeout: (userId) => {
      // 找到该用户的 socket 通知超时
      const sock = findSocketByUserId(io, userId);
      sock?.emit('match:timeout');
    },
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.userId!;
    const player = (): Player => ({
      id: userId,
      socketId: socket.id,
      name: socket.userName ?? '未知',
      avatar: socket.userAvatar ?? '❓',
      ready: true,
      isHost: false,
      connected: true,
    });

    // ===== 大厅 =====
    socket.on('lobby:subscribe', () => {
      socket.join('lobby');
      lobby.subscribe(socket.id, store.findPublic());
    });

    socket.on('lobby:unsubscribe', () => {
      socket.leave('lobby');
      lobby.unsubscribe(socket.id);
    });

    // ===== 快速匹配 =====
    socket.on('match:queue', () => {
      // 已在房间则忽略
      if (store.findByPlayerId(userId)) return;
      match.enqueue(userId, player());
    });

    socket.on('match:cancel', () => {
      match.cancel(userId);
    });

    // ===== 创建/加入房间 =====
    socket.on('room:create', (input: { name?: string } | undefined) => {
      // 已在房间则忽略
      if (store.findByPlayerId(userId)) return;
      const host = { ...player(), isHost: true };
      const name = input?.name?.trim() || makeRoomName(host.name);
      const room = store.create(userId, host, { name });
      joinSocketToRoom(io, socket.id, room.roomId);
      broadcastRoomState(io, room);
      // 通知大厅：新房
      const pub = toPublicRoom(room);
      if (pub) lobby.broadcastRoomAdded(pub);
    });

    socket.on('room:join', (input: { roomId: string }) => {
      if (store.findByPlayerId(userId)) return; // 已在房间
      const room = store.get(input.roomId);
      if (!room) {
        socket.emit('room:error', { message: '房间不存在' });
        return;
      }
      if (isFull(room)) {
        socket.emit('room:error', { message: '房间已满' });
        return;
      }
      // 加入：进房自动 ready=true
      const guest = { ...player(), isHost: false, ready: true };
      room.players.push(guest);
      const newState = nextWaitingState(room);
      if (canTransition(room.state, newState)) room.state = newState;
      joinSocketToRoom(io, socket.id, room.roomId);
      broadcastRoomState(io, room);
      // 通知大厅：房间人数变化
      const pub = toPublicRoom(room);
      if (pub) lobby.broadcastRoomChanged(pub);
    });

    // ===== 离开 =====
    socket.on('room:leave', () => {
      handlePlayerLeave(io, socket, store, lobby);
    });

    // ===== 准备 =====
    socket.on('player:ready', (input: { ready: boolean }) => {
      const room = store.findByPlayerId(userId);
      if (!room) return;
      const p = room.players.find((x) => x.id === userId);
      if (!p) return;
      p.ready = input.ready;
      broadcastRoomState(io, room);
      const pub = toPublicRoom(room);
      if (pub) lobby.broadcastRoomChanged(pub);
    });

    // ===== 房主开始 =====
    socket.on('room:start', () => {
      const room = store.findByPlayerId(userId);
      if (!room) return;
      // 校验：是房主 + 人齐 + 全员准备
      const isHost = room.players.find((p) => p.id === userId)?.isHost;
      if (!isHost) {
        socket.emit('room:error', { message: '只有房主能开始' });
        return;
      }
      if (!isFull(room) || !allReady(room)) {
        socket.emit('room:error', { message: '需要全员准备' });
        return;
      }
      if (!canTransition(room.state, 'countdown')) return;
      room.state = 'countdown';
      broadcastRoomState(io, room);
      // 通知大厅：房间不再可见（进 countdown 不在 waiting/ready）
      // broadcastRoomChanged 已通过 broadcastRoomState 间接触发？不，countdown 不投影。
      // 房间从大厅列表移除（toPublicRoom 返回 null）
      lobby.broadcastRoomRemoved(room.roomId);

      // 倒计时
      let remaining = COUNTDOWN_SECONDS;
      io.to(room.roomId).emit('room:countdown', { remaining });
      const timer = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
          io.to(room.roomId).emit('room:countdown', { remaining });
        } else {
          clearInterval(timer);
          // 计划二占位：countdown 结束回 ready（计划三改为进 playing + game:start）
          if (canTransition('countdown', 'ready')) {
            room.state = 'ready';
            // 重新准备状态？保持 ready，让房主可再次开始
            broadcastRoomState(io, room);
            const pub = toPublicRoom(room);
            if (pub) lobby.broadcastRoomAdded(pub);
          }
        }
      }, 1000);
    });

    // ===== 断线 =====
    socket.on('disconnect', () => {
      // 离开大厅
      lobby.unsubscribe(socket.id);
      // 离开房间
      handlePlayerDisconnect(io, socket, store, lobby, match, userId);
    });
  });
}

// ===== 辅助函数 =====

function joinSocketToRoom(io: SocketIOServer, socketId: string, roomId: string): void {
  const sock = io.sockets.sockets.get(socketId);
  sock?.join(roomId);
}

function broadcastRoomState(io: SocketIOServer, room: { roomId: string }): void {
  // 注意：这里需要完整 room 对象，重载签名见下
}

// 上面的 broadcastRoomState 签名不对，修正：接收完整 Room
// （为避免类型问题，把 broadcastRoomState 定义为接收 store 的 Room）

function findSocketByUserId(io: SocketIOServer, userId: string): Socket | undefined {
  for (const sock of io.sockets.sockets.values()) {
    if (sock.userId === userId) return sock;
  }
  return undefined;
}

function handlePlayerLeave(
  io: SocketIOServer,
  socket: Socket,
  store: ReturnType<typeof createRoomStore>,
  lobby: ReturnType<typeof createLobbyService>,
): void {
  const userId = socket.userId!;
  const room = store.findByPlayerId(userId);
  if (!room) return;
  removePlayerFromRoom(io, socket, store, lobby, room, userId);
}

function handlePlayerDisconnect(
  io: SocketIOServer,
  socket: Socket,
  store: ReturnType<typeof createRoomStore>,
  lobby: ReturnType<typeof createLobbyService>,
  match: ReturnType<typeof createMatchService>,
  userId: string,
): void {
  match.cancel(userId);
  const room = store.findByPlayerId(userId);
  if (!room) return;
  removePlayerFromRoom(io, socket, store, lobby, room, userId);
}

function removePlayerFromRoom(
  io: SocketIOServer,
  socket: Socket,
  store: ReturnType<typeof createRoomStore>,
  lobby: ReturnType<typeof createLobbyService>,
  room: ReturnType<typeof createRoomStore>['get'] extends (id: string) => infer R ? Exclude<R, null> : never,
  userId: string,
): void {
  const wasPublic = toPublicRoom(room) !== null;
  room.players = room.players.filter((p) => p.id !== userId);
  socket.leave(room.roomId);

  if (room.players.length === 0) {
    // 没人了，销毁
    store.remove(room.roomId);
    if (wasPublic) lobby.broadcastRoomRemoved(room.roomId);
    return;
  }

  // 如果走的是房主，转让房主给剩下的第一个人
  if (room.hostId === userId) {
    const newHost = room.players[0];
    newHost.isHost = true;
    room.hostId = newHost.id;
    room.name = makeRoomName(newHost.name);
  }

  // 状态回退：人少了回到 waiting
  const newState = nextWaitingState(room);
  if (canTransition(room.state, newState)) room.state = newState;
  broadcastRoomStateFull(io, room);

  const pub = toPublicRoom(room);
  if (pub && wasPublic) lobby.broadcastRoomChanged(pub);
}
```

**重要修正：** 上面这个初稿有几个类型问题（`broadcastRoomState` 签名、`removePlayerFromRoom` 的 room 类型）。实际实现时需要修正：

1. 删除空的 `broadcastRoomState` 函数，改成 `broadcastRoomStateFull(io, room: Room)`，内联调用 `io.to(room.roomId).emit('room:state', toRoomStatePayload(room))`。
2. `removePlayerFromRoom` 直接接收 `Room` 类型（从 store 拿到的就是 Room）。
3. 所有调用 `broadcastRoomState(io, room)` 的地方改成 `broadcastRoomStateFull(io, room)`。

修正后的完整版本（以此为准，覆盖上面的初稿）：

```typescript
// 把这个函数加到文件，删除上面有问题的 broadcastRoomState 空壳
function broadcastRoomStateFull(io: SocketIOServer, room: Room): void {
  io.to(room.roomId).emit('room:state', toRoomStatePayload(room));
}
```

并把 `removePlayerFromRoom` 签名简化为：

```typescript
function removePlayerFromRoom(
  io: SocketIOServer,
  socket: Socket,
  store: ReturnType<typeof createRoomStore>,
  lobby: ReturnType<typeof createLobbyService>,
  room: Room,
  userId: string,
): void { /* 同上 */ }
```

> 实现者：以上代码块是为了说清逻辑结构。请以"能通过 Task 8 集成测试"为准来写最终代码，修正所有类型问题。导入 `Room` 类型：`import type { Room } from '../types/room.js'`。把 `broadcastRoomState(io, room)` 调用统一改成 `broadcastRoomStateFull(io, room)`，并在文件里只保留这一个广播函数。

- [ ] **Step 2: 创建 barrel `server/src/rooms/index.ts`**

```typescript
export { attachRoomHandlers } from './roomHandlers.js';
```

- [ ] **Step 3: tsc 类型检查**

Run: `cd D:\BrainTrain\server && npx tsc --noEmit`
Expected: 0 错误。如有类型错误，修正（重点是 broadcastRoomStateFull 和 removePlayerFromRoom 的类型）。

- [ ] **Step 4: Commit**

```bash
cd D:\BrainTrain
git add server/src/rooms/roomHandlers.ts server/src/rooms/index.ts
git commit -m "feat(rooms): Socket.IO 事件编排（大厅/匹配/房间/准备/开始/断线）"
```

---

## Task 8: 接入 app.ts + 集成测试

**Files:**
- Modify: `server/src/app.ts`（加 `attachRoomHandlers(io)`）
- Test: `server/tests/roomHandlers.test.ts`

- [ ] **Step 1: 修改 `server/src/app.ts`，在 attachAuthMiddleware 后接 roomHandlers**

读现有 app.ts，在 `attachAuthMiddleware(io);` 之后加：

```typescript
import { attachRoomHandlers } from './rooms/index.js';
// ...
attachAuthMiddleware(io);
attachRoomHandlers(io);
```

- [ ] **Step 2: 写集成测试 `server/tests/roomHandlers.test.ts`**

复用计划一的 Socket.IO 真实 server 模式（建 HTTP server + socket.io-client 连）。需要 DB（建号拿 token）。

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import express from 'express';
import { authRouter } from '../src/auth/authRoutes.js';
import { attachAuthMiddleware } from '../src/realtime/socketAuth.js';
import { attachRoomHandlers } from '../src/rooms/index.js';
import './setupDb.js';

// 复用计划一的测试 server 构造模式
async function startTestServer(): Promise<{
  port: number;
  close: () => Promise<void>;
}> {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);

  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, { cors: { origin: '*' } });
  attachAuthMiddleware(io);
  attachRoomHandlers(io);

  return new Promise((resolve) => {
    httpServer.listen(0, () => {
      const port = (httpServer.address() as { port: number }).port;
      resolve({
        port,
        close: () => new Promise<void>((res) => {
          io.close();
          httpServer.close(() => res());
        }),
      });
    });
  });
}

// 建号 + 连 socket
async function makeClient(port: number): Promise<ClientSocket> {
  const authRes = await fetch(`http://localhost:${port}/api/auth/anonymous`, { method: 'POST' });
  const { token } = (await authRes.json()) as { token: string };
  return new Promise((resolve, reject) => {
    const sock = ioc(`http://localhost:${port}`, { auth: { token } });
    sock.on('connect', () => resolve(sock));
    sock.on('connect_error', reject);
  });
}

// 收下一个指定事件
function waitFor<T>(sock: ClientSocket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`超时等 ${event}`)), timeoutMs);
    sock.once(event, (data: T) => {
      clearTimeout(t);
      resolve(data);
    });
  });
}

describe('房间系统集成', () => {
  let port = 0;
  let close: () => Promise<void> = () => Promise.resolve();
  let clients: ClientSocket[] = [];

  afterEach(async () => {
    clients.forEach((c) => c.disconnect());
    clients = [];
    await close();
  });

  async function setup(): Promise<number> {
    const server = await startTestServer();
    port = server.port;
    close = server.close;
    return port;
  }

  async function client(): Promise<ClientSocket> {
    const c = await makeClient(port);
    clients.push(c);
    return c;
  }

  it('大厅：建房后订阅者收到 roomAdded', async () => {
    const p = await setup();
    const lobbyClient = await client();
    const hostClient = await client();

    // lobbyClient 进大厅
    lobbyClient.emit('lobby:subscribe');
    const list = await waitFor<{ roomId: string }[]>(lobbyClient, 'lobby:list');
    expect(list).toEqual([]);

    // hostClient 建房
    hostClient.emit('room:create', {});
    const added = await waitFor<{ name: string }>(lobbyClient, 'lobby:roomAdded');
    expect(added.name).toContain('的房间');
  });

  it('建房→加入→人齐进 ready', async () => {
    await setup();
    const host = await client();
    const guest = await client();

    host.emit('room:create', {});
    const hostState1 = await waitFor<{ state: string; players: { id: string }[] }>(host, 'room:state');
    expect(hostState1.state).toBe('waiting');
    expect(hostState1.players).toHaveLength(1);

    const roomId = hostState1.roomId;
    guest.emit('room:join', { roomId });

    // host 应收到状态更新（进 ready）
    const hostState2 = await waitFor<{ state: string; players: unknown[] }>(host, 'room:state');
    expect(hostState2.state).toBe('ready');
    expect(hostState2.players).toHaveLength(2);

    // guest 也收到 room:state
    const guestState = await waitFor<{ state: string; players: unknown[] }>(guest, 'room:state');
    expect(guestState.state).toBe('ready');
    expect(guestState.players).toHaveLength(2);
  });

  it('准备切换广播', async () => {
    await setup();
    const host = await client();
    const guest = await client();
    host.emit('room:create', {});
    const st = await waitFor<{ roomId: string }>(host, 'room:state');
    guest.emit('room:join', { roomId: st.roomId });
    await waitFor(host, 'room:state'); // 等 ready

    // guest 取消准备
    guest.emit('player:ready', { ready: false });
    const after = await waitFor<{ players: { ready: boolean }[] }>(guest, 'room:state');
    const guestPlayer = after.players.find((_, i, arr) => i === arr.length - 1);
    // 至少有一个 ready=false
    expect(after.players.some((p) => p.ready === false)).toBe(true);
  });

  it('房主开始 → countdown → 倒计时事件 → 回 ready（计划二占位）', async () => {
    await setup();
    const host = await client();
    const guest = await client();
    host.emit('room:create', {});
    const st = await waitFor<{ roomId: string }>(host, 'room:state');
    guest.emit('room:join', { roomId: st.roomId });
    await waitFor(host, 'room:state'); // ready

    // 双方都 ready（进房已自动 ready），房主点开始
    host.emit('room:start');

    // 收到 countdown 事件
    const cd1 = await waitFor<{ remaining: number }>(host, 'room:countdown');
    expect(cd1.remaining).toBe(3);

    // 倒数到 0 后回 ready
    const finalState = await waitFor<{ state: string }>(host, 'room:state', 5000);
    expect(finalState.state).toBe('ready');
  }, 10000);

  it('非房主点开始被拒', async () => {
    await setup();
    const host = await client();
    const guest = await client();
    host.emit('room:create', {});
    const st = await waitFor<{ roomId: string }>(host, 'room:state');
    guest.emit('room:join', { roomId: st.roomId });
    await waitFor(host, 'room:state');

    guest.emit('room:start');
    const err = await waitFor<{ message: string }>(guest, 'room:error');
    expect(err.message).toContain('房主');
  });

  it('快速匹配：两人入队自动配对', async () => {
    await setup();
    const a = await client();
    const b = await client();

    a.emit('match:queue');
    b.emit('match:queue');

    const foundA = await waitFor<{ opponent: { name: string } }>(a, 'match:found');
    const foundB = await waitFor<{ opponent: { name: string } }>(b, 'match:found');
    expect(foundA.opponent).toBeTruthy();
    expect(foundB.opponent).toBeTruthy();
  });

  it('断线：对方离开后房间人少回 waiting，空了销毁', async () => {
    await setup();
    const host = await client();
    const guest = await client();
    host.emit('room:create', {});
    const st = await waitFor<{ roomId: string }>(host, 'room:state');
    guest.emit('room:join', { roomId: st.roomId });
    await waitFor(host, 'room:state'); // ready

    // guest 断线
    guest.disconnect();

    // host 应收到状态回退到 waiting（人少了）
    const after = await waitFor<{ state: string; players: unknown[] }>(host, 'room:state', 3000);
    expect(after.state).toBe('waiting');
    expect(after.players).toHaveLength(1);
  }, 8000);
});
```

- [ ] **Step 3: 跑集成测试**

Run: `cd D:\BrainTrain\server && npx vitest run tests/roomHandlers.test.ts`
Expected: 全绿。这是本计划的核心验证。

**注意"准备切换"测试里 `after.players.find((_, i, arr) => i === arr.length - 1)` 写法有问题**——find 的回调第一个参数是元素不是索引。实现时改成：找到 ready=false 的那个玩家。修正：

```typescript
guest.emit('player:ready', { ready: false });
const after = await waitFor<{ players: { id: string; ready: boolean }[] }>(guest, 'room:state');
const guestEntry = after.players.find((p) => p.id !== /* host id */ '');
// 简单断言：至少一人 ready=false
expect(after.players.some((p) => p.ready === false)).toBe(true);
```

以这个简化断言为准。

- [ ] **Step 4: 跑全部测试确认无回归**

Run: `cd D:\BrainTrain\server && npm test`
Expected: 计划一的全部测试 + 计划二新测试全绿。

- [ ] **Step 5: Commit**

```bash
cd D:\BrainTrain
git add server/src/app.ts server/tests/roomHandlers.test.ts
git commit -m "feat(rooms): 接入 app + 房间系统集成测试"
```

---

## Task 9: 服务器部署 + 端到端验证

**Files:** 无（部署 + 手动验证）

- [ ] **Step 1: 把 server/ 重新打包传到服务器**

```bash
cd D:\BrainTrain
tar --exclude='server/node_modules' --exclude='server/dist' --exclude='server/.env' -czf /tmp/server.tar.gz server/
scp -i "C:\Users\xxzoi\.ssh\DOKE.pem" /tmp/server.tar.gz ubuntu@dokeplay.icu:/tmp/server.tar.gz
ssh -i "C:\Users\xxzoi\.ssh\DOKE.pem" ubuntu@dokeplay.icu 'cd /data && tar -xzf /tmp/server.tar.gz'
```

- [ ] **Step 2: 服务器上 build + 重启 PM2**

```bash
ssh -i "C:\Users\xxzoi\.ssh\DOKE.pem" ubuntu@dokeplay.icu 'cd /data/server && npm install && npm run build && pm2 restart braintrain-server && sleep 2 && pm2 logs braintrain-server --nostream --lines 3'
```
Expected: 启动日志 `[server] 多人对战后端已启动，端口 3001`，无错误。

- [ ] **Step 3: 服务器上跑测试**

```bash
ssh -i "C:\Users\xxzoi\.ssh\DOKE.pem" ubuntu@dokeplay.icu 'cd /data/server && npm test 2>&1 | tail -15'
```
Expected: 全绿。

- [ ] **Step 4: 端到端验证（两个 socket 客户端模拟建房→加入→开始→倒计时）**

在本地写脚本连 `https://www.dokeplay.icu`，模拟 host 和 guest：

```bash
cd D:\BrainTrain\brain-train
# 写 e2e-room-test.mjs（参考计划一的 socket-test.mjs 模式）
# host: anonymous → room:create → 等 room:state
# guest: anonymous → room:join → 等 room:state(ready) → player:ready 保持
# host: room:start → 等 room:countdown → 等 room:state(ready 回来)
node e2e-room-test.mjs
```
Expected: 打印全流程成功（建房→加入→ready→countdown 3-2-1→回 ready）。

- [ ] **Step 5: 验证前端站点无回归**

```bash
powershell.exe -NoProfile -Command "(Invoke-WebRequest -UseBasicParsing -Uri 'https://www.dokeplay.icu/').StatusCode"
```
Expected: 200。

- [ ] **Step 6: 清理临时文件**

```bash
rm D:\BrainTrain\brain-train\e2e-room-test.mjs 2>/dev/null
ssh -i "C:\Users\xxzoi\.ssh\DOKE.pem" ubuntu@dokeplay.icu 'rm -f /tmp/server.tar.gz'
```

---

## 完成标志

1. ✅ `cd server && npm test` 全绿（计划一 + 计划二所有测试）
2. ✅ 手动端到端：建房→加入→准备→开始→countdown→回 ready 整条链路
3. ✅ 服务器部署后经 HTTPS 验证房间事件流通
4. ✅ 前端站点无回归

## 后续计划交接

本计划交付的事件契约，供计划五（前端 UI）对接：
- 大厅：`lobby:subscribe`/`lobby:list`/`lobby:roomAdded`/`lobby:roomChanged`/`lobby:roomRemoved`/`lobby:unsubscribe`
- 匹配：`match:queue`/`match:cancel`/`match:found`/`match:timeout`
- 房间：`room:create`/`room:join`/`room:leave`/`player:ready`/`room:start`/`room:state`/`room:countdown`/`room:error`

计划三接手 countdown：把 roomHandlers 里"countdown 结束回 ready"改成"进 playing + emit game:start"，并接舒尔特游戏逻辑。
