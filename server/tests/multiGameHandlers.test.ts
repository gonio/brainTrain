import { describe, it, expect, afterEach } from 'vitest';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import express from 'express';
import { authRouter } from '../src/auth/authRoutes.js';
import { attachAuthMiddleware } from '../src/realtime/socketAuth.js';
import { attachRoomHandlers } from '../src/rooms/index.js';
import './setupDb.js';

async function startTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, { cors: { origin: '*' } });
  attachAuthMiddleware(io);
  attachRoomHandlers(io);
  return new Promise<{ port: number; close: () => Promise<void> }>((resolve) => {
    httpServer.listen(0, () => {
      const port = (httpServer.address() as { port: number }).port;
      resolve({ port, close: () => new Promise<void>((res) => { io.close(); httpServer.close(() => res()); }) });
    });
  });
}
async function makeClient(port: number) {
  const r = await fetch(`http://localhost:${port}/api/auth/anonymous`, { method: 'POST' });
  const { token } = await r.json() as { token: string };
  return new Promise<ClientSocket>((resolve, reject) => {
    const s = ioc(`http://localhost:${port}`, { auth: { token } });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}
function expectEvent<T>(sock: ClientSocket, event: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`超时等 ${event}`)), timeoutMs);
    sock.once(event, (data: T) => { clearTimeout(t); resolve(data); });
  });
}

describe('多游戏对战集成', () => {
  let port = 0;
  let close: () => Promise<void> = () => Promise.resolve();
  let clients: ClientSocket[] = [];

  afterEach(async () => { clients.forEach((c) => c.disconnect()); clients = []; await close(); });

  async function setupGame(games: string[], roundMode: 'single' | 'multi' = 'single') {
    const server = await startTestServer();
    port = server.port; close = server.close;
    const host = await makeClient(port); clients.push(host);
    const guest = await makeClient(port); clients.push(guest);
    host.emit('room:create', { roundMode, games });
    const st = await expectEvent<{ roomId: string }>(host, 'room:state');
    guest.emit('room:join', { roomId: st.roomId });
    await expectEvent(host, 'room:state');
    const startP = expectEvent<{ mode: string; seed: Record<string, unknown> }>(host, 'game:start', 6000);
    const guestStartP = expectEvent(guest, 'game:start', 6000);
    host.emit('room:start');
    const start = await startP;
    await guestStartP;
    return { host, guest, start };
  }

  it('单局暗瓶：host 排对 → game:end，host 胜', async () => {
    const { host, start } = await setupGame(['bottle']);
    expect(start.mode).toBe('bottle');
    const seed = start.seed as { targetSequence: string[] };
    const endP = expectEvent<{ winner: string; myResult: { won: boolean; accuracy: number } }>(host, 'game:end', 5000);
    host.emit('game:action', { mode: 'bottle', payload: { playerSequence: seed.targetSequence } });
    const end = await endP;
    expect(end.winner).toBe('me');
    expect(end.myResult.accuracy).toBe(1);
  }, 20000);

  it('单局字色：一方答完触发 grace，对方不答 → 超时结算', async () => {
    const { host, start } = await setupGame(['stroop']);
    expect(start.mode).toBe('stroop');
    const seed = start.seed as { questions: { correctAnswer: string }[] };
    const graceP = expectEvent<{ seconds: number }>(host, 'game:grace', 5000);
    // host 答完 10 题
    for (let i = 0; i < seed.questions.length; i++) {
      host.emit('game:action', { mode: 'stroop', payload: { questionIndex: i, answer: seed.questions[i].correctAnswer } });
      await new Promise((r) => setTimeout(r, 10));
    }
    const grace = await graceP;
    expect(grace.seconds).toBe(10);
    const endP = expectEvent<{ winner: string }>(host, 'game:end', 15000);
    const end = await endP;
    expect(end.winner).toBe('me');
  }, 35000);

  it('单局序列：双方都提交才结算', async () => {
    const { host, guest, start } = await setupGame(['sequence']);
    expect(start.mode).toBe('sequence');
    const seed = start.seed as { sequence: string[] };
    // host 先提交，不应立即结算
    const hostEndP = expectEvent(host, 'game:end', 8000);
    host.emit('game:action', { mode: 'sequence', payload: { userSequence: seed.sequence } });
    // 等 1s 确认没结束
    await new Promise((r) => setTimeout(r, 1000));
    // guest 再提交 → 结算
    guest.emit('game:action', { mode: 'sequence', payload: { userSequence: seed.sequence } });
    const end = await hostEndP;
    // 双方都对 → 比时间，host 先提交更快 → host 胜（或平局如果时间相同）
    expect(['me', 'draw']).toContain(end.winner);
  }, 35000);

  it('多局：舒尔特→字色，打完舒尔特收到 room:nextRound', async () => {
    const { host, start } = await setupGame(['schulte', 'stroop'], 'multi');
    expect(start.mode).toBe('schulte');
    const schulteSeed = start.seed as { grid: number[]; order: number[] };
    const nextRoundP = expectEvent<{ nextMode: string; queueIndex: number }>(host, 'room:nextRound', 12000);
    // host 点完舒尔特
    for (let i = 0; i < schulteSeed.order.length; i++) {
      const cellIndex = schulteSeed.grid.indexOf(schulteSeed.order[i]);
      host.emit('game:action', { mode: 'schulte', payload: { cellIndex } });
      await new Promise((r) => setTimeout(r, 10));
    }
    const next = await nextRoundP;
    expect(next.nextMode).toBe('stroop');
    expect(next.queueIndex).toBe(1);
  }, 35000);

  it('多局打完最后收到 room:roundEnd + hostCanChangeGames', async () => {
    const { host, start } = await setupGame(['schulte'], 'single');
    const schulteSeed = start.seed as { grid: number[]; order: number[] };
    // 先注册 roundEnd 和 room:state 监听（两者在同一 setTimeout 里同时触发）
    const roundEndP = expectEvent<{ roundResults: unknown[] }>(host, 'room:roundEnd', 12000);
    const stateP = expectEvent<{ hostCanChangeGames: boolean }>(host, 'room:state', 12000);
    for (let i = 0; i < schulteSeed.order.length; i++) {
      const cellIndex = schulteSeed.grid.indexOf(schulteSeed.order[i]);
      host.emit('game:action', { mode: 'schulte', payload: { cellIndex } });
      await new Promise((r) => setTimeout(r, 10));
    }
    const re = await roundEndP;
    expect(re.roundResults).toHaveLength(1);
    const state = await stateP;
    expect(state.hostCanChangeGames).toBe(true);
  }, 35000);

  it('reconfigure：本轮结束后房主改游戏', async () => {
    const { host, start } = await setupGame(['schulte'], 'single');
    const schulteSeed = start.seed as { grid: number[]; order: number[] };
    // 先注册 roundEnd 和 room:state（两者在同一 setTimeout 里同时触发）
    const roundEndP = expectEvent(host, 'room:roundEnd', 12000);
    const hostChangeP = expectEvent<{ hostCanChangeGames: boolean }>(host, 'room:state', 12000);
    for (let i = 0; i < schulteSeed.order.length; i++) {
      const cellIndex = schulteSeed.grid.indexOf(schulteSeed.order[i]);
      host.emit('game:action', { mode: 'schulte', payload: { cellIndex } });
      await new Promise((r) => setTimeout(r, 10));
    }
    await roundEndP;
    const hostChangeState = await hostChangeP;
    expect(hostChangeState.hostCanChangeGames).toBe(true);
    // reconfigure
    const stateP = expectEvent<{ gameMode: string; gameQueue: string[] }>(host, 'room:state', 3000);
    host.emit('room:reconfigure', { roundMode: 'single', games: ['bottle'] });
    const state = await stateP;
    expect(state.gameMode).toBe('bottle');
    expect(state.gameQueue).toEqual(['bottle']);
  }, 40000);

  it('非房主退出 → 本轮重置（roundResults 清空）', async () => {
    const { host, guest, start } = await setupGame(['schulte', 'stroop'], 'multi');
    const schulteSeed = start.seed as { grid: number[]; order: number[] };
    // 先注册 nextRound 监听，再打完第一局触发它
    const nextRoundP = expectEvent(host, 'room:nextRound', 12000);
    for (let i = 0; i < schulteSeed.order.length; i++) {
      const cellIndex = schulteSeed.grid.indexOf(schulteSeed.order[i]);
      host.emit('game:action', { mode: 'schulte', payload: { cellIndex } });
      await new Promise((r) => setTimeout(r, 10));
    }
    await nextRoundP;
    // guest 退出
    const stateP = expectEvent<{ currentQueueIndex: number; roundResults: unknown[] }>(host, 'room:state', 3000);
    guest.emit('room:leave');
    const state = await stateP;
    expect(state.currentQueueIndex).toBe(0);  // 重置回 0
    expect(state.roundResults).toHaveLength(0);  // 清空
  }, 35000);
});
