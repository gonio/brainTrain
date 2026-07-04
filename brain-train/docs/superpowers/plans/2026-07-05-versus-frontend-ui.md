# 多人对战 - 计划五：前端 UI（大厅 + 对战页 + 排行榜占位）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户能在浏览器里真正玩舒尔特 1v1：首页入口 → 多人大厅（房间列表 + 快速匹配 + 创建房间）→ 房间（准备/开始/倒计时）→ 对战（同表竞速、对方进度条）→ 结果页（胜负 + 准确率）。打通计划一~三的后端能力。

**Architecture:** 新增 3 个页面 + 1 个组件目录。`Versus`（大厅）和 `VersusRoom`（房间状态机）是核心；`VersusSchulteBoard` 复用 SchulteGrid 的渲染/点击/反馈，但 grid 来自服务器；房间状态机模仿 `Quest.tsx` 的 view 切换模式。Socket 事件通过计划一的 `versusSocket` 单例 + 新增 `versusRoomStore`（Zustand）管理。排行榜页是占位（计划四未做）。

**Tech Stack:** React 19, TypeScript, react-router-dom 6 (data router), Zustand, Tailwind v4, Framer Motion, socket.io-client, Vitest + RTL。

**Spec:** `brain-train/docs/superpowers/specs/2026-07-04-multiplayer-versus-design.md`（第 8 章 + 事件契约来自计划二/三）

---

## 范围边界

**本计划做：** 首页多人对战入口卡、`/versus` 大厅页（房间列表 + 快速匹配 + 创建房间）、`/versus/room/:roomId` 房间状态机（ready/countdown/playing/result）、`VersusSchulteBoard` 对战组件、结果页、`/leaderboard` 占位页、生产环境 API base 修正。

**本计划不做（留给后续）：**
- 排行榜真实数据（计划四未做，本计划只放「即将上线」占位）
- 战绩历史页
- 断线重连 UI（断线即负，结果页显示即可）
- 4 人/多游戏（架构已参数化但 UI 只做 1v1 舒尔特）

---

## 关键前置修正：生产环境 API base

`versusApi.ts` 和 `versusSocket.ts` 当前默认 `http://localhost:3001`。生产环境前端和后端同源（Nginx 反代 `/api` 和 `/socket.io`），所以 base 应为**空字符串**（走相对路径/同源）。Task 1 修正这个。

逻辑：
- 开发：`import.meta.env.VITE_VERSUS_API_BASE ?? 'http://localhost:3001'`（vite dev 跑 5173，后端 3001，需显式 base 或 vite proxy）
- 生产：`.env` 不设 `VITE_VERSUS_API_BASE`，但需要区分——最简单：生产构建时 base 用空字符串（同源），开发用 localhost:3001。

实现：改为 `import.meta.env.DEV ? 'http://localhost:3001' : ''`（vite 内置 `DEV` flag，构建时静态替换，生产为 `false` → base 为 `''` → 同源）。删掉 `VITE_VERSUS_API_BASE` 依赖。

---

## 文件结构总览

### 新增前端文件

| 文件 | 职责 |
|---|---|
| `src/types/versus.ts` | 扩展：加房间/游戏/事件载荷类型（Room/Player/GameStartPayload 等，镜像后端） |
| `src/stores/versusRoomStore.ts` | Zustand：房间状态（room/players/view/gameData）+ 事件 reducer |
| `src/lib/versusSocket.ts` | 改：加事件订阅辅助 `onRoom(socket, handlers)` 统一注册/清理 |
| `src/lib/versusApi.ts` | 改：API base 用 DEV flag（Task 1） |
| `src/lib/versusSocket.ts` | 改：socket base 用 DEV flag（Task 1） |
| `src/components/versus/VersusSchulteBoard.tsx` | 对战棋盘：接收 server grid，点击 emit tap，本地即时反馈 |
| `src/components/versus/PlayerProgress.tsx` | 进度条：显示 found/errors（自己和对手） |
| `src/components/versus/RoomHUD.tsx` | 房间顶部条：对手信息 + 双方准备状态 |
| `src/components/versus/VersusResultDialog.tsx` | 结果弹窗：胜负 + 准确率 + 再玩/返回 |
| `src/components/versus/CountdownOverlay.tsx` | 3-2-1 倒计时遮罩（收 room:countdown 事件） |
| `src/components/versus/index.ts` | barrel |
| `src/pages/Versus.tsx` | 大厅页：房间列表 + 快速匹配 + 创建房间 |
| `src/pages/VersusRoom.tsx` | 房间页状态机：ready/countdown/playing/result |
| `src/pages/Leaderboard.tsx` | 排行榜占位页 |

### 改动前端文件

| 文件 | 改动 |
|---|---|
| `src/App.tsx` | 首页加「多人对战」入口卡 + 加 3 个路由（/versus, /versus/room/:roomId, /leaderboard） |
| `src/components/layout/AppLayout.tsx` | GAME_PATHS 加 `/versus/room`（对战时隐藏底栏） |

### 新增测试文件

| 文件 | 覆盖 |
|---|---|
| `tests/unit/versusRoomStore.test.ts` | store 状态机 + 事件 reducer |
| `tests/unit/VersusSchulteBoard.test.tsx` | 渲染 grid、点击 emit tap、错点反馈 |

---

## 任务依赖图

```
Task 1 (API base 修正 + 类型扩展) ─┬─→ Task 2 (versusRoomStore) [TDD]
                                   └─→ Task 3 (VersusSchulteBoard) [TDD]
                                              │
                                   Task 4 (PlayerProgress + RoomHUD + CountdownOverlay + ResultDialog)
                                              │
                                   Task 5 (Versus 大厅页)
                                              │
                                   Task 6 (VersusRoom 房间页状态机)
                                              │
                                   Task 7 (路由 + 首页入口 + AppLayout + Leaderboard 占位)
                                              │
                                   Task 8 (服务器部署 + 浏览器实玩验证)
```

Task 1 基础。Task 2/3 独立可测。Task 4 是纯展示组件（无单测，靠 Task 8 浏览器验证）。Task 5/6/7 页面组装。Task 8 部署实玩。

---

## Task 1: API base 修正 + versus 类型扩展

**Files:**
- Modify: `src/lib/versusApi.ts`
- Modify: `src/lib/versusSocket.ts`
- Modify: `src/types/versus.ts`

- [ ] **Step 1: 修正 versusApi.ts 的 API base**

读现有 `src/lib/versusApi.ts`。把：
```typescript
const API_BASE = import.meta.env.VITE_VERSUS_API_BASE ?? 'http://localhost:3001';
```
改为：
```typescript
// 开发环境连本地后端（3001），生产环境同源（Nginx 反代 /api）
const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
```

- [ ] **Step 2: 修正 versusSocket.ts 的 socket base**

读现有 `src/lib/versusSocket.ts`。同样把 SOCKET_BASE 改为：
```typescript
const SOCKET_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
```

- [ ] **Step 3: 扩展 src/types/versus.ts，加房间/游戏/事件类型**

读现有文件，在末尾追加（保留现有 VersusUser/AuthResult）：

```typescript
// ============ 房间类型（镜像后端 server/src/types/room.ts）============

export type RoomState = 'waiting' | 'ready' | 'countdown' | 'playing' | 'finished' | 'closed';
export type GameMode = 'schulte';

export interface VersusPlayer {
  id: string;
  name: string;
  avatar: string;
  ready: boolean;
  isHost: boolean;
  connected: boolean;
}

export interface PublicRoom {
  roomId: string;
  name: string;
  hostName: string;
  playerCount: number;
  gameMode: GameMode;
  state: 'waiting' | 'ready';
}

// ============ Socket 事件载荷（镜像后端）============

// S→C: room:state
export interface RoomStatePayload {
  roomId: string;
  name: string;
  state: RoomState;
  players: VersusPlayer[];
  gameMode: GameMode;
}

// S→C: match:found
export interface MatchFoundPayload {
  roomId: string;
  opponent: { id: string; name: string; avatar: string };
}

// S→C: game:start
export interface GameStartPayload {
  grid: number[];
  startTime: number;
  size: number;
  target: number;
  timeLimitMs: number;
}

// S→C: game:progress
export interface GameProgressPayload {
  me: { found: number; errors: number; done: boolean };
  opponent: { found: number; errors: number; done: boolean };
}

export interface PlayerResult {
  playerId: string;
  found: number;
  errors: number;
  accuracy: number;
  timeMs: number;
  done: boolean;
  won: boolean;
}

// S→C: game:end
export interface GameEndPayload {
  winner: 'me' | 'opponent' | 'draw';
  myResult: PlayerResult;
  opponentResult: PlayerResult;
}

// S→C: room:countdown
export interface CountdownPayload {
  remaining: number;
}

// S→C: room:error / lobby 事件
export interface RoomErrorPayload {
  message: string;
}
```

- [ ] **Step 4: 验证 build + 测试无回归**

Run: `cd D:\BrainTrain\brain-train && npm run build`
Expected: 成功。

Run: `cd D:\BrainTrain\brain-train && npx vitest run 2>&1 | tail -5`
Expected: 全绿（189 测试，无回归）。

- [ ] **Step 5: Commit**

```bash
cd D:\BrainTrain
git add brain-train/src/lib/versusApi.ts brain-train/src/lib/versusSocket.ts brain-train/src/types/versus.ts
git commit -m "feat(versus): 修正 API base（DEV flag）+ 扩展房间/游戏类型"
```

---

## Task 2: versusRoomStore（Zustand TDD）

**Files:**
- Test: `tests/unit/versusRoomStore.test.ts`
- Create: `src/stores/versusRoomStore.ts`

管理房间/游戏状态的 Zustand store。事件 reducer 模式：socket 事件调用 store 的 action 更新状态。

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useVersusRoomStore } from '../../src/stores/versusRoomStore';
import type { RoomStatePayload, GameStartPayload, GameProgressPayload, GameEndPayload, MatchFoundPayload } from '../../src/types/versus';

beforeEach(() => {
  useVersusRoomStore.getState().reset();
});

describe('versusRoomStore', () => {
  it('初始状态：无房间、view=lobby', () => {
    const s = useVersusRoomStore.getState();
    expect(s.room).toBeNull();
    expect(s.view).toBe('lobby');
    expect(s.gameData).toBeNull();
  });

  it('setRoomState 更新房间 + 自动切 view', () => {
    const payload: RoomStatePayload = {
      roomId: 'r1', name: '测试房', state: 'ready',
      players: [
        { id: 'me', name: '我', avatar: '🦊', ready: true, isHost: true, connected: true },
        { id: 'op', name: '对手', avatar: '🐰', ready: true, isHost: false, connected: true },
      ],
      gameMode: 'schulte',
    };
    useVersusRoomStore.getState().setRoomState(payload);
    const s = useVersusRoomStore.getState();
    expect(s.room?.roomId).toBe('r1');
    expect(s.view).toBe('ready'); // ready 状态 → view=ready
  });

  it('setRoomState 收到 playing → view=playing', () => {
    useVersusRoomStore.getState().setRoomState({
      roomId: 'r1', name: 'x', state: 'playing',
      players: [], gameMode: 'schulte',
    });
    expect(useVersusRoomStore.getState().view).toBe('playing');
  });

  it('setCountdown → view=countdown', () => {
    useVersusRoomStore.getState().setCountdown(3);
    expect(useVersusRoomStore.getState().view).toBe('countdown');
    expect(useVersusRoomStore.getState().countdown).toBe(3);
  });

  it('onMatchFound 设置房间 id', () => {
    const payload: MatchFoundPayload = { roomId: 'r1', opponent: { id: 'op', name: '对手', avatar: '🐰' } };
    useVersusRoomStore.getState().onMatchFound(payload);
    expect(useVersusRoomStore.getState().matchedRoomId).toBe('r1');
  });

  it('onGameStart 设置 gameData + view=playing', () => {
    const payload: GameStartPayload = { grid: [1,2,3], startTime: 1000, size: 5, target: 25, timeLimitMs: 90000 };
    useVersusRoomStore.getState().onGameStart(payload);
    const s = useVersusRoomStore.getState();
    expect(s.gameData?.grid).toEqual([1,2,3]);
    expect(s.view).toBe('playing');
  });

  it('onGameProgress 更新进度', () => {
    const payload: GameProgressPayload = {
      me: { found: 5, errors: 1, done: false },
      opponent: { found: 3, errors: 0, done: false },
    };
    useVersusRoomStore.getState().onGameProgress(payload);
    expect(useVersusRoomStore.getState().progress).toEqual(payload);
  });

  it('onGameEnd 设置结果 + view=result', () => {
    const payload: GameEndPayload = {
      winner: 'me',
      myResult: { playerId: 'me', found: 25, errors: 0, accuracy: 1, timeMs: 30000, done: true, won: true },
      opponentResult: { playerId: 'op', found: 0, errors: 25, accuracy: 0, timeMs: 90000, done: false, won: false },
    };
    useVersusRoomStore.getState().onGameEnd(payload);
    const s = useVersusRoomStore.getState();
    expect(s.endResult?.winner).toBe('me');
    expect(s.view).toBe('result');
  });

  it('reset 清空所有', () => {
    useVersusRoomStore.getState().onGameProgress({ me: { found: 1, errors: 0, done: false }, opponent: { found: 0, errors: 0, done: false } });
    useVersusRoomStore.getState().reset();
    expect(useVersusRoomStore.getState().progress).toBeNull();
    expect(useVersusRoomStore.getState()).toMatchObject({ room: null, view: 'lobby', gameData: null });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd D:\BrainTrain\brain-train && npx vitest run tests/unit/versusRoomStore.test.ts`
Expected: FAIL — 模块找不到。

- [ ] **Step 3: 实现 src/stores/versusRoomStore.ts**

```typescript
// 多人对战房间/游戏状态 store。socket 事件 → action → 状态。
import { create } from 'zustand';
import type {
  RoomStatePayload, GameStartPayload, GameProgressPayload,
  GameEndPayload, MatchFoundPayload, VersusPlayer, RoomState,
} from '../types/versus';

export type VersusView = 'lobby' | 'ready' | 'countdown' | 'playing' | 'result';

interface RoomSnapshot {
  roomId: string;
  name: string;
  state: RoomState;
  players: VersusPlayer[];
  gameMode: string;
}

interface VersusRoomState {
  view: VersusView;
  room: RoomSnapshot | null;
  matchedRoomId: string | null;       // match:found 收到后用于跳转
  countdown: number | null;
  gameData: GameStartPayload | null;
  progress: GameProgressPayload | null;
  endResult: GameEndPayload | null;
  error: string | null;

  // 事件 actions（socket handler 调用）
  setRoomState: (payload: RoomStatePayload) => void;
  setCountdown: (remaining: number) => void;
  onMatchFound: (payload: MatchFoundPayload) => void;
  onGameStart: (payload: GameStartPayload) => void;
  onGameProgress: (payload: GameProgressPayload) => void;
  onGameEnd: (payload: GameEndPayload) => void;
  setError: (msg: string | null) => void;
  setView: (v: VersusView) => void;
  reset: () => void;
}

// room:state 的 state → view 映射
function stateToView(state: RoomState): VersusView {
  if (state === 'waiting' || state === 'ready') return 'ready';
  if (state === 'countdown') return 'countdown';
  if (state === 'playing') return 'playing';
  return 'ready'; // finished/closed 兜底
}

export const useVersusRoomStore = create<VersusRoomState>((set) => ({
  view: 'lobby',
  room: null,
  matchedRoomId: null,
  countdown: null,
  gameData: null,
  progress: null,
  endResult: null,
  error: null,

  setRoomState: (payload) => set({
    room: {
      roomId: payload.roomId,
      name: payload.name,
      state: payload.state,
      players: payload.players,
      gameMode: payload.gameMode,
    },
    view: stateToView(payload.state),
  }),

  setCountdown: (remaining) => set({ countdown: remaining, view: 'countdown' }),

  onMatchFound: (payload) => set({ matchedRoomId: payload.roomId }),

  onGameStart: (payload) => set({ gameData: payload, view: 'playing', progress: null }),

  onGameProgress: (payload) => set({ progress: payload }),

  onGameEnd: (payload) => set({ endResult: payload, view: 'result' }),

  setError: (msg) => set({ error: msg }),
  setView: (v) => set({ view: v }),

  reset: () => set({
    view: 'lobby', room: null, matchedRoomId: null, countdown: null,
    gameData: null, progress: null, endResult: null, error: null,
  }),
}));
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd D:\BrainTrain\brain-train && npx vitest run tests/unit/versusRoomStore.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
cd D:\BrainTrain
git add brain-train/src/stores/versusRoomStore.ts brain-train/tests/unit/versusRoomStore.test.ts
git commit -m "feat(versus): 房间/游戏状态 store（事件 reducer 模式）"
```

---

## Task 3: VersusSchulteBoard（TDD）

**Files:**
- Test: `tests/unit/VersusSchulteBoard.test.tsx`
- Create: `src/components/versus/VersusSchulteBoard.tsx`

接收服务器下发的 grid，渲染 + 点击 + 本地即时反馈（高亮/震动）+ emit game:tap。**不本地算分**（服务器权威）。

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VersusSchulteBoard } from '../../src/components/versus/VersusSchulteBoard';

// mock framer-motion（jsdom 下避免动画问题）
vi.mock('framer-motion', () => ({
  motion: { button: ({ children, ...props }: any) => <button {...props}>{children}</button> },
}));

describe('VersusSchulteBoard', () => {
  const grid = [1, 2, 3, 4, 5, 6, 7, 8, 9]; // 3x3 简化测试

  it('渲染 grid 所有数字', () => {
    render(<VersusSchulteBoard grid={grid} size={3} onTap={() => {}} />);
    for (const n of grid) {
      expect(screen.getByText(String(n))).toBeInTheDocument();
    }
  });

  it('点击正确数字触发 onTap（cellIndex）', () => {
    const onTap = vi.fn();
    render(<VersusSchulteBoard grid={grid} size={3} onTap={onTap} />);
    // 该点 1，grid[0]=1，cellIndex=0
    fireEvent.click(screen.getByText('1'));
    expect(onTap).toHaveBeenCalledWith(0);
  });

  it('点错不推进（但仍 emit tap 让服务器记错）', () => {
    const onTap = vi.fn();
    render(<VersusSchulteBoard grid={grid} size={3} onTap={onTap} />);
    // 该点 1，但点 grid[1]=2
    fireEvent.click(screen.getByText('2'));
    expect(onTap).toHaveBeenCalledWith(1);
    // 再点 1 仍触发（没因错点锁死）
    fireEvent.click(screen.getByText('1'));
    expect(onTap).toHaveBeenCalledWith(0);
  });

  it('disabled 时不响应点击', () => {
    const onTap = vi.fn();
    render(<VersusSchulteBoard grid={grid} size={3} onTap={onTap} disabled />);
    fireEvent.click(screen.getByText('1'));
    expect(onTap).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd D:\BrainTrain\brain-train && npx vitest run tests/unit/VersusSchulteBoard.test.tsx`
Expected: FAIL。

- [ ] **Step 3: 实现 src/components/versus/VersusSchulteBoard.tsx**

```typescript
import { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface VersusSchulteBoardProps {
  grid: number[];          // 服务器下发的表
  size: number;            // 如 5（5x5）
  onTap: (cellIndex: number) => void;  // 点击上报（emit game:tap）
  disabled?: boolean;      // 倒计时/结束时禁用
}

// 舒尔特对战棋盘：grid 来自服务器，点击本地即时反馈 + 上报。
// 不本地算分（服务器权威）。本地 found 只用于决定「下一个该点的数」做视觉反馈。
export function VersusSchulteBoard({ grid, size, onTap, disabled = false }: VersusSchulteBoardProps) {
  // 本地已正确点数（只用于判断下一个该点的数 + 视觉）
  const foundRef = useRef(0);
  const [clickedCells, setClickedCells] = useState<Set<number>>(new Set());
  const [wrongCell, setWrongCell] = useState<number | null>(null);
  const wrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback((cellIndex: number) => {
    if (disabled) return;
    const expectedNumber = foundRef.current + 1;
    const tappedNumber = grid[cellIndex];

    // 无论对错都上报（服务器记分）
    onTap(cellIndex);

    if (tappedNumber === expectedNumber) {
      // 对：本地推进
      foundRef.current += 1;
      setClickedCells((prev) => new Set(prev).add(cellIndex));
    } else {
      // 错：震动反馈（不推进 found）
      setWrongCell(cellIndex);
      if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = setTimeout(() => setWrongCell(null), 450);
    }
  }, [disabled, grid, onTap]);

  return (
    <div className="flex items-center justify-center w-full">
      <div className="relative w-full max-w-md aspect-square bg-surface-container-low rounded-xl p-4 shadow-2xl">
        <div
          className="grid gap-3 h-full w-full"
          style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
        >
          {grid.map((number, cellIndex) => {
            const isClicked = clickedCells.has(cellIndex);
            const isWrong = wrongCell === cellIndex;
            return (
              <motion.button
                key={cellIndex}
                onClick={() => handleClick(cellIndex)}
                disabled={disabled || isClicked}
                animate={isWrong ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
                transition={isWrong ? { duration: 0.45 } : { duration: 0 }}
                className={`
                  flex items-center justify-center rounded-xl font-bold
                  transition-colors duration-150 cursor-pointer active:scale-95
                  ${isWrong
                    ? 'bg-red-500/30 text-red-600 ring-2 ring-red-500'
                    : isClicked
                      ? 'bg-primary/20 text-primary'
                      : 'bg-surface-container text-foreground hover:bg-surface-container-high shadow-sm'
                  }
                `}
                style={{ fontSize: size >= 6 ? '0.9rem' : undefined }}
              >
                {number}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd D:\BrainTrain\brain-train && npx vitest run tests/unit/VersusSchulteBoard.test.tsx`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
cd D:\BrainTrain
git add brain-train/src/components/versus/VersusSchulteBoard.tsx brain-train/tests/unit/VersusSchulteBoard.test.tsx
git commit -m "feat(versus): 舒尔特对战棋盘组件（server grid + 即时反馈）"
```

---

## Task 4: 辅助展示组件（PlayerProgress / RoomHUD / CountdownOverlay / VersusResultDialog）

**Files:**
- Create: `src/components/versus/PlayerProgress.tsx`
- Create: `src/components/versus/RoomHUD.tsx`
- Create: `src/components/versus/CountdownOverlay.tsx`
- Create: `src/components/versus/VersusResultDialog.tsx`
- Create: `src/components/versus/index.ts`

纯展示组件，无单测（靠 Task 8 浏览器验证）。每个文件职责单一。

- [ ] **Step 1: PlayerProgress.tsx（进度条）**

```typescript
interface PlayerProgressProps {
  name: string;
  avatar: string;
  found: number;
  errors: number;
  target: number;
  isMe: boolean;
  done: boolean;
}

export function PlayerProgress({ name, avatar, found, errors, target, isMe, done }: PlayerProgressProps) {
  const pct = target > 0 ? Math.min(100, (found / target) * 100) : 0;
  return (
    <div className={`rounded-2xl p-3 ${isMe ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-surface-container'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{avatar}</span>
          <span className="font-bold text-sm">{isMe ? '我' : name}</span>
          {done && <span className="text-xs text-success font-bold">✓ 完成</span>}
        </div>
        <span className="text-xs text-muted-foreground">
          {found}/{target} {errors > 0 && <span className="text-destructive">×{errors}</span>}
        </span>
      </div>
      <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${isMe ? 'bg-primary' : 'bg-secondary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: RoomHUD.tsx（房间顶部信息）**

```typescript
import type { VersusPlayer } from '../../types/versus';

interface RoomHUDProps {
  roomId: string;
  players: VersusPlayer[];
  myUserId: string;
}

export function RoomHUD({ players, myUserId }: RoomHUDProps) {
  const me = players.find((p) => p.id === myUserId);
  const opponent = players.find((p) => p.id !== myUserId);
  return (
    <div className="flex items-center justify-between bg-surface-container rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <span className="text-3xl">{me?.avatar}</span>
        <div>
          <div className="font-bold text-sm">{me?.name}</div>
          <div className="text-xs text-success">{me?.ready ? '已准备' : '未准备'}</div>
        </div>
      </div>
      <span className="material-symbols-outlined text-2xl text-muted-foreground">swords</span>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="font-bold text-sm">{opponent?.name ?? '等待中…'}</div>
          <div className="text-xs text-muted-foreground">{opponent?.ready ? '已准备' : '未准备'}</div>
        </div>
        <span className="text-3xl">{opponent?.avatar ?? '❓'}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: CountdownOverlay.tsx（倒计时遮罩）**

```typescript
interface CountdownOverlayProps {
  remaining: number | null;
}

export function CountdownOverlay({ remaining }: CountdownOverlayProps) {
  if (remaining === null) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="text-8xl font-headline font-extrabold text-primary animate-pulse-ring">
        {remaining > 0 ? remaining : 'GO!'}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: VersusResultDialog.tsx（结果弹窗）**

```typescript
import type { GameEndPayload } from '../../types/versus';

interface VersusResultDialogProps {
  result: GameEndPayload;
  onPlayAgain: () => void;
  onExit: () => void;
}

export function VersusResultDialog({ result, onPlayAgain, onExit }: VersusResultDialogProps) {
  const { winner, myResult, opponentResult } = result;
  const title = winner === 'me' ? '胜利！' : winner === 'opponent' ? '失败' : '平局';
  const titleColor = winner === 'me' ? 'text-success' : winner === 'opponent' ? 'text-destructive' : 'text-muted-foreground';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6">
      <div className="bg-surface rounded-3xl p-8 max-w-sm w-full shadow-2xl">
        <h2 className={`font-headline text-4xl font-extrabold text-center mb-6 ${titleColor}`}>{title}</h2>
        <div className="space-y-3 mb-6">
          <ResultRow label="我" result={myResult} highlight={winner === 'me'} />
          <ResultRow label="对手" result={opponentResult} highlight={winner === 'opponent'} />
        </div>
        <div className="space-y-3">
          <button
            onClick={onPlayAgain}
            className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-2xl hover:opacity-90 transition-opacity"
          >
            再来一局
          </button>
          <button
            onClick={onExit}
            className="w-full py-3 bg-surface-container text-foreground font-bold rounded-2xl hover:bg-surface-container-high transition-colors"
          >
            返回大厅
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultRow({ label, result, highlight }: { label: string; result: GameEndPayload['myResult']; highlight: boolean }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl ${highlight ? 'bg-success/10' : 'bg-surface-container'}`}>
      <span className="font-bold">{label}</span>
      <div className="text-right text-sm">
        <div>正确率 <span className="font-bold">{(result.accuracy * 100).toFixed(1)}%</span></div>
        <div className="text-muted-foreground">{result.found} 对 / {result.errors} 错 · {(result.timeMs / 1000).toFixed(1)}s</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: index.ts barrel**

```typescript
export { VersusSchulteBoard } from './VersusSchulteBoard';
export { PlayerProgress } from './PlayerProgress';
export { RoomHUD } from './RoomHUD';
export { CountdownOverlay } from './CountdownOverlay';
export { VersusResultDialog } from './VersusResultDialog';
```

- [ ] **Step 6: tsc 检查**

Run: `cd D:\BrainTrain\brain-train && npx tsc -b --noEmit 2>&1 | head -10` （或 `npm run build`）
Expected: 无类型错误。如有，修。

- [ ] **Step 7: Commit**

```bash
cd D:\BrainTrain
git add brain-train/src/components/versus/
git commit -m "feat(versus): 展示组件（进度条/房间HUD/倒计时/结果弹窗）"
```

---

## Task 5: Versus 大厅页

**Files:**
- Create: `src/pages/Versus.tsx`

大厅：房间列表（实时）+ 快速匹配按钮 + 创建房间按钮。进页时建号 + 连 socket + 订阅大厅。

- [ ] **Step 1: 实现 src/pages/Versus.tsx**

```typescript
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useVersusRoomStore } from '../stores/versusRoomStore';
import { connectVersus, getSocket } from '../lib/versusSocket';
import type { PublicRoom } from '../types/versus';

export function Versus() {
  const navigate = useNavigate();
  const { user, token, ensureAuthenticated } = useAuthStore();
  const { matchedRoomId, reset } = useVersusRoomStore();
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [matchmaking, setMatchmaking] = useState(false);
  const [connected, setConnected] = useState(false);

  // 建号 + 连 socket + 订阅大厅
  useEffect(() => {
    let socket: ReturnType<typeof getSocket> = null;
    (async () => {
      await ensureAuthenticated();
      const t = useAuthStore.getState().token;
      if (!t) return;
      socket = connectVersus(t);
      setConnected(socket.connected);

      socket.on('lobby:list', setRooms);
      socket.on('lobby:roomAdded', (room: PublicRoom) => setRooms((prev) => [...prev, room]));
      socket.on('lobby:roomChanged', (room: PublicRoom) => setRooms((prev) => prev.map((r) => r.roomId === room.roomId ? room : r)));
      socket.on('lobby:roomRemoved', ({ roomId }: { roomId: string }) => setRooms((prev) => prev.filter((r) => r.roomId !== roomId)));
      socket.on('connect', () => setConnected(true));
      socket.on('disconnect', () => setConnected(false));

      socket.emit('lobby:subscribe');
    })();

    return () => {
      if (socket) {
        socket.emit('lobby:unsubscribe');
        socket.off('lobby:list');
        socket.off('lobby:roomAdded');
        socket.off('lobby:roomChanged');
        socket.off('lobby:roomRemoved');
      }
    };
  }, [ensureAuthenticated]);

  // 匹配成功 → 跳房间
  useEffect(() => {
    if (matchedRoomId) {
      navigate(`/versus/room/${matchedRoomId}`);
    }
  }, [matchedRoomId, navigate]);

  const handleQuickMatch = () => {
    const socket = getSocket();
    if (!socket) return;
    setMatchmaking(true);
    socket.on('match:found', () => setMatchmaking(false));
    socket.on('match:timeout', () => { setMatchmaking(false); });
    socket.emit('match:queue');
  };

  const handleCancelMatch = () => {
    const socket = getSocket();
    socket?.emit('match:cancel');
    setMatchmaking(false);
  };

  const handleCreateRoom = () => {
    const socket = getSocket();
    if (!socket) return;
    // 建房后等服务端 room:state 推过来，房间页会接手
    socket.once('room:state', (payload: { roomId: string }) => {
      navigate(`/versus/room/${payload.roomId}`);
    });
    socket.emit('room:create', {});
  };

  const handleJoinRoom = (roomId: string) => {
    const socket = getSocket();
    if (!socket) return;
    socket.once('room:state', (payload: { roomId: string }) => {
      navigate(`/versus/room/${payload.roomId}`);
    });
    socket.emit('room:join', { roomId });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-2xl font-extrabold">多人大厅</h1>
        <span className={`text-xs ${connected ? 'text-success' : 'text-muted-foreground'}`}>
          {connected ? '● 已连接' : '○ 连接中…'}
        </span>
      </div>

      {/* 快速匹配 */}
      <button
        onClick={matchmaking ? handleCancelMatch : handleQuickMatch}
        disabled={!connected}
        className={`w-full py-4 font-bold text-lg rounded-2xl transition-opacity disabled:opacity-50 ${
          matchmaking ? 'bg-destructive text-destructive-foreground' : 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
        }`}
      >
        {matchmaking ? '取消匹配…' : '⚡ 快速匹配'}
      </button>

      {/* 创建房间 */}
      <button
        onClick={handleCreateRoom}
        disabled={!connected}
        className="w-full py-4 bg-primary text-primary-foreground font-bold text-lg rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        ＋ 创建房间
      </button>

      {/* 房间列表 */}
      <div>
        <h2 className="font-headline text-lg font-bold mb-3">公开房间</h2>
        {rooms.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">暂无公开房间，创建一个或快速匹配吧</p>
        ) : (
          <div className="space-y-2">
            {rooms.map((room) => (
              <button
                key={room.roomId}
                onClick={() => handleJoinRoom(room.roomId)}
                disabled={room.playerCount >= 2}
                className="w-full flex items-center justify-between p-4 bg-surface-container rounded-2xl hover:bg-surface-container-high transition-colors disabled:opacity-50 text-left"
              >
                <div>
                  <div className="font-bold">{room.name}</div>
                  <div className="text-xs text-muted-foreground">房主：{room.hostName}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${room.playerCount >= 2 ? 'text-muted-foreground' : 'text-success'}`}>
                    {room.playerCount}/2
                  </span>
                  <span className="material-symbols-outlined">chevron_right</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: build 检查**

Run: `cd D:\BrainTrain\brain-train && npm run build`
Expected: 成功（类型错误则修）。

- [ ] **Step 3: Commit**

```bash
cd D:\BrainTrain
git add brain-train/src/pages/Versus.tsx
git commit -m "feat(versus): 多人大厅页（房间列表 + 快速匹配 + 创建房间）"
```

---

## Task 6: VersusRoom 房间页状态机

**Files:**
- Create: `src/pages/VersusRoom.tsx`

核心页：按 store.view 分发渲染 ready/countdown/playing/result。注册所有房间/游戏 socket 事件。

- [ ] **Step 1: 实现 src/pages/VersusRoom.tsx**

```typescript
import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useVersusRoomStore } from '../stores/versusRoomStore';
import { getSocket } from '../lib/versusSocket';
import { VersusSchulteBoard, PlayerProgress, RoomHUD, CountdownOverlay, VersusResultDialog } from '../components/versus';
import type { RoomStatePayload, CountdownPayload, GameStartPayload, GameProgressPayload, GameEndPayload, RoomErrorPayload } from '../types/versus';

export function VersusRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const {
    view, room, countdown, gameData, progress, endResult, error,
    setRoomState, setCountdown, onGameStart, onGameProgress, onGameEnd, setError, reset,
  } = useVersusRoomStore();

  // 注册所有 socket 事件（进页一次）
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handlers: Record<string, (data: unknown) => void> = {
      'room:state': (d) => setRoomState(d as RoomStatePayload),
      'room:countdown': (d) => setCountdown((d as CountdownPayload).remaining),
      'game:start': (d) => onGameStart(d as GameStartPayload),
      'game:progress': (d) => onGameProgress(d as GameProgressPayload),
      'game:end': (d) => onGameEnd(d as GameEndPayload),
      'room:error': (d) => setError((d as RoomErrorPayload).message),
    };
    for (const [event, handler] of Object.entries(handlers)) {
      socket.on(event, handler);
    }

    return () => {
      for (const event of Object.keys(handlers)) {
        socket.off(event);
      }
    };
  }, [setRoomState, setCountdown, onGameStart, onGameProgress, onGameEnd, setError]);

  const myUserId = user?.id ?? '';
  const me = room?.players.find((p) => p.id === myUserId);
  const opponent = room?.players.find((p) => p.id !== myUserId);
  const isHost = me?.isHost ?? false;
  const allReady = room?.players.every((p) => p.ready) ?? false;
  const isFull = (room?.players.length ?? 0) >= 2;

  const handleToggleReady = () => {
    getSocket()?.emit('player:ready', { ready: !me?.ready });
  };

  const handleStart = () => {
    getSocket()?.emit('room:start');
  };

  const handleTap = (cellIndex: number) => {
    getSocket()?.emit('game:tap', { cellIndex });
  };

  const handlePlayAgain = () => {
    // 回到 ready 视图，等房主再开始（服务器 endGame 已把房间回 ready/waiting）
    reset();
    navigate('/versus');
  };

  const handleExit = () => {
    getSocket()?.emit('room:leave');
    reset();
    navigate('/versus');
  };

  // ===== 按 view 分发渲染 =====

  if (view === 'result' && endResult) {
    return <VersusResultDialog result={endResult} onPlayAgain={handlePlayAgain} onExit={handleExit} />;
  }

  if (view === 'playing' && gameData) {
    const myProg = progress?.me ?? { found: 0, errors: 0, done: false };
    const opProg = progress?.opponent ?? { found: 0, errors: 0, done: false };
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <PlayerProgress
            name={me?.name ?? '我'} avatar={me?.avatar ?? '❓'}
            found={myProg.found} errors={myProg.errors} target={gameData.target}
            isMe done={myProg.done}
          />
          <PlayerProgress
            name={opponent?.name ?? '对手'} avatar={opponent?.avatar ?? '❓'}
            found={opProg.found} errors={opProg.errors} target={gameData.target}
            isMe={false} done={opProg.done}
          />
        </div>
        <VersusSchulteBoard grid={gameData.grid} size={gameData.size} onTap={handleTap} />
      </div>
    );
  }

  // view === 'ready' 或 'countdown'（countdown 时仍显示房间界面 + 遮罩）
  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-xl text-sm">{error}</div>
      )}

      {room && <RoomHUD roomId={room.roomId} players={room.players} myUserId={myUserId} />}

      <div className="text-center py-4">
        <p className="text-muted-foreground">
          {isFull ? (allReady ? '房主可以开始游戏了' : '等待所有玩家准备…') : '等待对手加入…'}
        </p>
      </div>

      {/* 准备/开始按钮 */}
      <div className="space-y-3">
        {!isHost && (
          <button
            onClick={handleToggleReady}
            className={`w-full py-4 font-bold text-lg rounded-2xl transition-opacity ${
              me?.ready ? 'bg-success text-success-foreground' : 'bg-primary text-primary-foreground'
            }`}
          >
            {me?.ready ? '✓ 已准备（点击取消）' : '准备'}
          </button>
        )}
        {isHost && (
          <button
            onClick={handleStart}
            disabled={!isFull || !allReady}
            className="w-full py-4 bg-primary text-primary-foreground font-bold text-lg rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isFull && allReady ? '开始游戏' : '等待准备…'}
          </button>
        )}
        <button
          onClick={handleExit}
          className="w-full py-3 bg-surface-container text-foreground font-bold rounded-2xl hover:bg-surface-container-high transition-colors"
        >
          离开房间
        </button>
      </div>

      <CountdownOverlay remaining={countdown} />
    </div>
  );
}
```

- [ ] **Step 2: build 检查**

Run: `cd D:\BrainTrain\brain-train && npm run build`
Expected: 成功。

- [ ] **Step 3: Commit**

```bash
cd D:\BrainTrain
git add brain-train/src/pages/VersusRoom.tsx
git commit -m "feat(versus): 房间页状态机（ready/countdown/playing/result）"
```

---

## Task 7: 路由 + 首页入口 + AppLayout + Leaderboard 占位

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/AppLayout.tsx`
- Create: `src/pages/Leaderboard.tsx`

- [ ] **Step 1: 创建 src/pages/Leaderboard.tsx（占位）**

```typescript
export function Leaderboard() {
  return (
    <div className="space-y-6">
      <h1 className="font-headline text-2xl font-extrabold">排行榜</h1>
      <div className="text-center py-16">
        <span className="material-symbols-outlined text-6xl text-muted-foreground mb-4 block">leaderboard</span>
        <p className="text-muted-foreground">排行榜即将上线</p>
        <p className="text-xs text-muted-foreground mt-2">完成更多对战，积分系统正在开发中</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 改 src/App.tsx —— 加 import + 路由 + 首页入口卡**

读现有 App.tsx。改动：

a) 顶部 import 加：
```typescript
import { Versus } from './pages/Versus';
import { VersusRoom } from './pages/VersusRoom';
import { Leaderboard } from './pages/Leaderboard';
```

b) `createBrowserRouter` 的 children 数组里，在 `games/*` 路由之前加：
```typescript
{ path: 'versus', element: <Versus /> },
{ path: 'versus/room/:roomId', element: <VersusRoom /> },
{ path: 'leaderboard', element: <Leaderboard /> },
```

c) Home 组件里，在「主线闯关」section 之后、「训练模式」grid 之前，加一个「多人对战」section：
```tsx
<section className="mb-8">
  <button
    onClick={() => navigate('/versus')}
    className="w-full p-6 bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-3xl text-left hover:opacity-95 transition-opacity shadow-lg"
  >
    <div className="flex items-center justify-between">
      <div>
        <h2 className="font-headline text-2xl font-extrabold mb-1">多人对战</h2>
        <p className="text-white/80 text-sm">实时 1v1 舒尔特竞速，比比谁更快</p>
      </div>
      <span className="material-symbols-outlined text-4xl">swords</span>
    </div>
  </button>
</section>
```

- [ ] **Step 3: 改 src/components/layout/AppLayout.tsx —— GAME_PATHS 加 versus/room**

读现有文件，找到 `GAME_PATHS` 数组，加 `'/versus/room'`（对战时隐藏底栏）：

```typescript
const GAME_PATHS = ['/games/schulte', '/games/stroop', '/games/sequence', '/games/bottle', '/versus/room'];
```

- [ ] **Step 4: build + 全测试无回归**

Run: `cd D:\BrainTrain\brain-train && npm run build`
Expected: 成功。

Run: `cd D:\BrainTrain\brain-train && npx vitest run 2>&1 | tail -5`
Expected: 全绿（189 + 新增 store/board 测试）。

- [ ] **Step 5: Commit**

```bash
cd D:\BrainTrain
git add brain-train/src/App.tsx brain-train/src/components/layout/AppLayout.tsx brain-train/src/pages/Leaderboard.tsx
git commit -m "feat(versus): 路由 + 首页多人对战入口 + 对战时隐藏底栏 + 排行榜占位"
```

---

## Task 8: 服务器部署 + 浏览器实玩验证

**Files:** 无（部署 + 手动验证）

- [ ] **Step 1: 前端 build**

Run: `cd D:\BrainTrain\brain-train && npm run build`
Expected: dist/ 生成（含 PWA）。

- [ ] **Step 2: 上传 dist 到服务器**

```bash
scp -r -i "C:/Users/xxzoi/.ssh/DOKE.pem" D:/BrainTrain/brain-train/dist/* ubuntu@dokeplay.icu:/data/www/
```
注意：服务器现有 `/data/www` 是旧 dist，需先清空再传（参考现有 deploy.yml 的 `rm -rf /data/www/*`）。或直接覆盖（scp -r 会覆盖同名）。安全起见先备份/确认。

更稳妥的命令（清空再传）：
```bash
ssh -i "C:/Users/xxzoi/.ssh/DOKE.pem" ubuntu@dokeplay.icu 'rm -rf /data/www/*'
scp -r -i "C:/Users/xxzoi/.ssh/DOKE.pem" D:/BrainTrain/brain-train/dist/* ubuntu@dokeplay.icu:/data/www/
```

- [ ] **Step 3: 验证后端仍在跑**

```bash
ssh -i "C:/Users/xxzoi/.ssh/DOKE.pem" ubuntu@dokeplay.icu 'pm2 list | grep braintrain'
powershell.exe -NoProfile -Command "(Invoke-WebRequest -UseBasicParsing -Uri 'https://www.dokeplay.icu/api/health').Content"
```
Expected: PM2 online，health 返回 ok。

- [ ] **Step 4: 浏览器实玩验证（手动）**

打开 `https://www.dokeplay.icu`，验证：
1. 首页能看到「多人对战」橙色卡片
2. 点进去 → 大厅页（显示「● 已连接」）
3. 点「创建房间」→ 进房间页，显示「等待对手加入」
4. **开第二个浏览器/隐身窗口**，同样进大厅，看到刚才的房间出现在列表
5. 第二个窗口点「加入」→ 双方都进 ready，RoomHUD 显示两人
6. 双方点准备 → 房主「开始游戏」按钮亮起
7. 房主点开始 → 3-2-1 倒计时遮罩
8. 倒计时结束 → 双方看到同一张 5x5 舒尔特表 + 双方进度条
9. 双方点击数字 → 进度条实时更新、点对高亮、点错震动变红
10. 先点完的一方 → 结果弹窗（胜利/失败/平局 + 准确率）
11. 点「返回大厅」→ 回大厅页

- [ ] **Step 5: 跑前端测试确认无回归（可选，本地已跑）**

- [ ] **Step 6: 清理**

无需清理（dist 是正式部署）。

---

## 完成标志

1. ✅ `cd brain-train && npm run build` 成功
2. ✅ `cd brain-train && npm test` 全绿（189 + 新增）
3. ✅ 浏览器实玩：建房→加入→准备→开始→倒计时→对战→结果 整条链路
4. ✅ 生产环境同源 API/socket 工作（DEV flag 生效）
5. ✅ 首页/单人模式无回归

## 后续计划交接

本计划完成后，**用户能真正玩舒尔特 1v1**。剩余：

- **计划四（战绩 + 排行榜）**：game:end 落库（matches + user_stats 表）+ REST 排行榜接口 + 把 Leaderboard 占位换成真实数据。
- **token 持久化**：authStore 当前只在内存，刷新页面会重建号丢战绩。计划四或单独小任务加 IndexedDB 持久化。
- **4 人/多游戏**：架构已参数化，UI 需扩展。
