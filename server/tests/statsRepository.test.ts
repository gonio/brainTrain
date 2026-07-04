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
  winnerId: aWon ? aId : bId,
  players: [
    { playerId: aId, name: 'A', avatar: '🦊', found: 25, errors: 0, accuracy: 1, timeMs: 30000, done: true, won: aWon },
    { playerId: bId, name: 'B', avatar: '🐰', found: 20, errors: 5, accuracy: 0.8, timeMs: 90000, done: false, won: !aWon },
  ],
});

describe('statsRepository', () => {
  it('recordMatch 写入并增量更新双方 user_stats', async () => {
    const a = await makeUser();
    const b = await makeUser();
    await recordMatch(matchInput(a.id, b.id, true));
    const statsA = await getMyStats(a.id);
    expect(statsA?.matches_played).toBe(1);
    expect(statsA?.wins).toBe(1);
    expect(statsA?.total_correct).toBe(25);
    const statsB = await getMyStats(b.id);
    expect(statsB?.matches_played).toBe(1);
    expect(statsB?.losses).toBe(1);
    expect(statsB?.total_correct).toBe(20);
  });

  it('recordMatch 多局累加', async () => {
    const a = await makeUser();
    const b = await makeUser();
    await recordMatch(matchInput(a.id, b.id, true));
    await recordMatch(matchInput(a.id, b.id, true));
    expect((await getMyStats(a.id))?.matches_played).toBe(2);
    expect((await getMyStats(a.id))?.total_correct).toBe(50);
  });

  it('recordMatch 平局：draws+1，winner_id null', async () => {
    const a = await makeUser();
    const b = await makeUser();
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

  it('getLeaderboard：5 局门槛 + 正确率排序', async () => {
    const a = await makeUser(); const b = await makeUser(); const c = await makeUser();
    for (let i = 0; i < 5; i++) await recordMatch(matchInput(a.id, c.id, true));
    for (let i = 0; i < 4; i++) await recordMatch(matchInput(b.id, c.id, true));
    const lb = await getLeaderboard(50);
    const ids = lb.entries.map((e) => e.userId);
    expect(ids).toContain(a.id);
    expect(ids).toContain(c.id);
    expect(ids).not.toContain(b.id); // b 不到 5 局
    expect(lb.entries[0].userId).toBe(a.id); // a 100% 排第一
  });

  it('getLeaderboard 正确率相同按时间升序', async () => {
    const a = await makeUser(); const b = await makeUser();
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
    expect(lb.entries[0].userId).toBe(a.id); // a 更快
  });

  it('getLeaderboard 带 myId 返回 myEntry', async () => {
    const a = await makeUser();
    for (let i = 0; i < 5; i++) await recordMatch(matchInput(a.id, (await makeUser()).id, true));
    const lb = await getLeaderboard(50, a.id);
    expect(lb.myEntry?.userId).toBe(a.id);
  });
});
