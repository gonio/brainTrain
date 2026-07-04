// 排行榜 + 个人统计路由
import { Router } from 'express';
import { requireAuth } from '../auth/authMiddleware.js';
import { getLeaderboard, getMyStats } from './statsRepository.js';

export const leaderboardRouter = Router();

// GET /api/leaderboard?mode=schulte&limit=50
leaderboardRouter.get('/leaderboard', requireAuth, async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10), 100);
  const myUserId = req.user?.id;
  const { entries, myEntry } = await getLeaderboard(limit, myUserId);
  res.json({ entries, myEntry });
});

// GET /api/me/stats
leaderboardRouter.get('/me/stats', requireAuth, async (req, res) => {
  const stats = await getMyStats(req.user!.id);
  if (!stats) {
    res.json({
      matchesPlayed: 0, wins: 0, losses: 0, draws: 0,
      avgAccuracy: 0, avgTimeMs: 0,
    });
    return;
  }
  const denom = stats.total_correct + stats.total_errors;
  res.json({
    matchesPlayed: stats.matches_played,
    wins: stats.wins,
    losses: stats.losses,
    draws: stats.draws,
    avgAccuracy: denom === 0 ? 0 : stats.total_correct / denom,
    avgTimeMs: stats.matches_played === 0 ? 0 : Math.round(stats.total_time_ms / stats.matches_played),
  });
});
