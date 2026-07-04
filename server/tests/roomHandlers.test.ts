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

async function makeClient(port: number): Promise<ClientSocket> {
  const authRes = await fetch(`http://localhost:${port}/api/auth/anonymous`, { method: 'POST' });
  const { token } = (await authRes.json()) as { token: string };
  return new Promise((resolve, reject) => {
    const sock = ioc(`http://localhost:${port}`, { auth: { token } });
    sock.on('connect', () => resolve(sock));
    sock.on('connect_error', reject);
  });
}

function waitFor<T>(sock: ClientSocket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`超时等 ${event}`)), timeoutMs);
    sock.once(event, (data: T) => {
      clearTimeout(t);
      resolve(data);
    });
  });
}

// 先注册监听器再执行动作，避免事件竞态（emit 瞬间完成、once 还没注册导致错过）
// 用法：const p = expectEvent(sock, 'match:found'); sock.emit(...); const data = await p;
function expectEvent<T>(sock: ClientSocket, event: string, timeoutMs = 2000): Promise<T> {
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
    await setup();
    const lobbyClient = await client();
    const hostClient = await client();

    lobbyClient.emit('lobby:subscribe');
    const list = await waitFor<{ roomId: string }[]>(lobbyClient, 'lobby:list');
    expect(list).toEqual([]);

    hostClient.emit('room:create', {});
    const added = await waitFor<{ name: string }>(lobbyClient, 'lobby:roomAdded');
    expect(added.name).toContain('的房间');
  });

  it('建房→加入→人齐进 ready', async () => {
    await setup();
    const host = await client();
    const guest = await client();

    host.emit('room:create', {});
    const hostState1 = await waitFor<{ roomId: string; state: string; players: unknown[] }>(host, 'room:state');
    expect(hostState1.state).toBe('waiting');
    expect(hostState1.players).toHaveLength(1);

    guest.emit('room:join', { roomId: hostState1.roomId });
    const hostState2 = await waitFor<{ state: string; players: unknown[] }>(host, 'room:state');
    expect(hostState2.state).toBe('ready');
    expect(hostState2.players).toHaveLength(2);

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
    await waitFor(guest, 'room:state'); // guest 收到 join 后的 room:state（双方 ready）

    // guest 取消准备。监听 host 端的 room:state（host 也会收到这次广播），
    // 断言至少一人 ready=false。用 host 监听避免 guest 端 join 事件的残留竞态。
    const stateP = expectEvent<{ players: { ready: boolean }[] }>(host, 'room:state');
    guest.emit('player:ready', { ready: false });
    const after = await stateP;
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

    host.emit('room:start');
    const cd1 = await waitFor<{ remaining: number }>(host, 'room:countdown');
    expect(cd1.remaining).toBe(3);

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

    // 先注册监听再 emit，避免竞态：第二个入队会瞬间触发匹配，
    // match:found 在 once 注册前发出会错过
    const foundAP = expectEvent<{ opponent: { name: string } }>(a, 'match:found');
    const foundBP = expectEvent<{ opponent: { name: string } }>(b, 'match:found');

    a.emit('match:queue');
    b.emit('match:queue');

    const foundA = await foundAP;
    const foundB = await foundBP;
    expect(foundA.opponent).toBeTruthy();
    expect(foundB.opponent).toBeTruthy();
  });

  it('断线：对方离开后房间人少回 waiting', async () => {
    await setup();
    const host = await client();
    const guest = await client();
    host.emit('room:create', {});
    const st = await waitFor<{ roomId: string }>(host, 'room:state');
    guest.emit('room:join', { roomId: st.roomId });
    await waitFor(host, 'room:state'); // ready

    guest.disconnect();
    const after = await waitFor<{ state: string; players: unknown[] }>(host, 'room:state', 3000);
    expect(after.state).toBe('waiting');
    expect(after.players).toHaveLength(1);
  }, 8000);
});
