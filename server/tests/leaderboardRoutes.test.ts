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
  it('GET /api/leaderboard 返回 entries', async () => {
    const app = await buildTestApp();
    const a = await makeUser();
    const res = await request(app).get('/api/leaderboard?mode=schulte&limit=50').set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.entries)).toBe(true);
  });

  it('GET /api/leaderboard 带 token 返回 myEntry（打过 5 局）', async () => {
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
    const res = await request(app).get('/api/leaderboard?limit=50').set('Authorization', `Bearer ${a.token}`);
    expect(res.body.myEntry?.userId).toBe(a.id);
    expect(res.body.myEntry?.matchesPlayed).toBe(5);
  });

  it('GET /api/me/stats 返回自己的统计', async () => {
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
    expect(res.body.matchesPlayed).toBe(1);
    expect(res.body.wins).toBe(1);
    expect(res.body.avgAccuracy).toBeCloseTo(1, 5);
  });

  it('GET /api/me/stats 未打过返回空统计', async () => {
    const app = await buildTestApp();
    const a = await makeUser();
    const res = await request(app).get('/api/me/stats').set('Authorization', `Bearer ${a.token}`);
    expect(res.body.matchesPlayed).toBe(0);
  });

  it('GET /api/me/stats 无 token 返回 401', async () => {
    const app = await buildTestApp();
    const res = await request(app).get('/api/me/stats');
    expect(res.status).toBe(401);
  });
});
