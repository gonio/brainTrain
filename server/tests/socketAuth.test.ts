import { describe, it, expect, afterEach } from 'vitest';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { attachAuthMiddleware } from '../src/realtime/socketAuth.js';
import { authRouter } from '../src/auth/authRoutes.js';
import express from 'express';

// 需要 DB 生命周期
import './setupDb.js';

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
