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

    await client.query(
      `INSERT INTO matches (room_id, game_mode, winner_id, players)
       VALUES ($1, $2, $3, $4)`,
      [input.roomId, input.gameMode, input.winnerId, JSON.stringify(input.players)],
    );

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

export async function getMyStats(userId: string): Promise<UserStatsRow | null> {
  const result = await pool.query(
    `SELECT user_id, matches_played, wins, losses, draws, total_correct, total_errors, total_time_ms
     FROM user_stats WHERE user_id = $1`,
    [userId],
  );
  if (result.rows.length === 0) return null;
  return result.rows[0] as UserStatsRow;
}

export async function getLeaderboard(
  limit: number,
  myUserId?: string,
): Promise<{ entries: LeaderboardEntry[]; myEntry: LeaderboardEntry | null }> {
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

  let myEntry: LeaderboardEntry | null = null;
  if (myUserId) {
    myEntry = entries.find((e) => e.userId === myUserId) ?? null;
  }

  return { entries: trimmed, myEntry };
}
