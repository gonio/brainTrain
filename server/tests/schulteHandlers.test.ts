import { describe, it, expect, afterEach } from 'vitest';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import express from 'express';
import { authRouter } from '../src/auth/authRoutes.js';
import { attachAuthMiddleware } from '../src/realtime/socketAuth.js';
import { attachRoomHandlers } from '../src/rooms/index.js';
import './setupDb.js';

async function startTestServer(): Promise<{ port: number; close: () => Promise<void> }> {
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
      resolve({ port, close: () => new Promise<void>((res) => { io.close(); httpServer.close(() => res()); }) });
    });
  });
}

async function makeClient(port: number): Promise<ClientSocket> {
  const r = await fetch(`http://localhost:${port}/api/auth/anonymous`, { method: 'POST' });
  const { token } = await r.json() as { token: string };
  return new Promise((resolve, reject) => {
    const s = ioc(`http://localhost:${port}`, { auth: { token } });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

function expectEvent<T>(sock: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`超时等 ${event}`)), timeoutMs);
    sock.once(event, (data: T) => { clearTimeout(t); resolve(data); });
  });
}

// 按顺序正确点完所有格子（1,2,3...找对应 cellIndex）
async function playPerfect(sock: ClientSocket, grid: number[]): Promise<void> {
  for (let target = 1; target <= grid.length; target++) {
    const cellIndex = grid.indexOf(target);
    sock.emit('game:tap', { cellIndex });
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('舒尔特对战集成', () => {
  let port = 0;
  let close: () => Promise<void> = () => Promise.resolve();
  let clients: ClientSocket[] = [];

  afterEach(async () => {
    clients.forEach((c) => c.disconnect());
    clients = [];
    await close();
  });

  async function setup(): Promise<void> {
    const server = await startTestServer();
    port = server.port;
    close = server.close;
  }

  async function client(): Promise<ClientSocket> {
    const c = await makeClient(port);
    clients.push(c);
    return c;
  }

  // 房主建房 + 客人加入 + 房主开始，返回 host/guest 和 game:start 数据
  async function setupGame(): Promise<{
    host: ClientSocket;
    guest: ClientSocket;
    hostStart: { grid: number[]; target: number };
    guestStart: { grid: number[]; target: number };
  }> {
    const host = await client();
    const guest = await client();
    host.emit('room:create', {});
    const st = await expectEvent<{ roomId: string }>(host, 'room:state');
    guest.emit('room:join', { roomId: st.roomId });
    await expectEvent(host, 'room:state'); // ready

    const hostStartP = expectEvent<{ grid: number[]; target: number }>(host, 'game:start');
    const guestStartP = expectEvent<{ grid: number[]; target: number }>(guest, 'game:start');
    host.emit('room:start');
    const hostStart = await hostStartP;
    const guestStart = await guestStartP;
    return { host, guest, hostStart, guestStart };
  }

  it('countdown 结束后双方收到同一张 game:start', async () => {
    await setup();
    const { hostStart, guestStart } = await setupGame();
    expect(hostStart.grid).toEqual(guestStart.grid);
    expect(hostStart.target).toBe(25);
    expect(hostStart.grid).toHaveLength(25);
  }, 15000);

  it('host 点完所有格子 → game:end，host 胜（guest 没动）', async () => {
    await setup();
    const { host, hostStart } = await setupGame();

    const hostEndP = expectEvent<{ winner: string; myResult: { won: boolean; accuracy: number } }>(host, 'game:end', 5000);
    await playPerfect(host, hostStart.grid);
    const end = await hostEndP;
    expect(end.winner).toBe('me');
    expect(end.myResult.won).toBe(true);
    expect(end.myResult.accuracy).toBe(1);
  }, 20000);

  it('游戏中断线 → 存活方收到 game:end 且胜', async () => {
    await setup();
    const { host, guest } = await setupGame();

    const hostEndP = expectEvent<{ winner: string; myResult: { won: boolean } }>(host, 'game:end', 5000);
    guest.disconnect();
    const end = await hostEndP;
    expect(end.winner).toBe('me');
    expect(end.myResult.won).toBe(true);
  }, 15000);

  it('进度广播：游戏中有 game:progress 事件', async () => {
    await setup();
    const { host, hostStart } = await setupGame();

    const progP = expectEvent<{ me: { found: number }; opponent: { found: number } }>(host, 'game:progress', 2000);
    for (let target = 1; target <= 3; target++) {
      host.emit('game:tap', { cellIndex: hostStart.grid.indexOf(target) });
      await new Promise((r) => setTimeout(r, 20));
    }
    const prog = await progP;
    expect(prog.me.found).toBeGreaterThanOrEqual(0);
  }, 15000);
});
