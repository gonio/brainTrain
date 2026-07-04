import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { versusApi } from '../lib/versusApi';
import type { LeaderboardEntry, MyStats } from '../types/versus';

export function Leaderboard() {
  const { ensureAuthenticated } = useAuthStore();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myEntry, setMyEntry] = useState<LeaderboardEntry | null>(null);
  const [myStats, setMyStats] = useState<MyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await ensureAuthenticated();
        const t = useAuthStore.getState().token;
        if (!t) return;
        const [lb, stats] = await Promise.all([
          versusApi.getLeaderboard(t),
          versusApi.getMyStats(t),
        ]);
        setEntries(lb.entries);
        setMyEntry(lb.myEntry);
        setMyStats(stats);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuthenticated]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中…</div>;
  if (error) return <div className="text-center py-12 text-destructive">加载失败：{error}</div>;

  return (
    <div className="space-y-6">
      <h1 className="font-headline text-2xl font-extrabold">排行榜</h1>

      {/* 我的统计卡片 */}
      {myStats && (
        <div className="bg-primary/10 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold">我的战绩</span>
            {myEntry ? (
              <span className="text-sm text-primary font-bold">第 {myEntry.rank} 名</span>
            ) : (
              <span className="text-xs text-muted-foreground">
                {myStats.matchesPlayed < 5 ? `再打 ${5 - myStats.matchesPlayed} 局即可上榜` : '未上榜'}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <div className="font-bold">{myStats.matchesPlayed}</div>
              <div className="text-xs text-muted-foreground">场次</div>
            </div>
            <div>
              <div className="font-bold">{(myStats.avgAccuracy * 100).toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">正确率</div>
            </div>
            <div>
              <div className="font-bold">{myStats.wins}胜{myStats.losses}负</div>
              <div className="text-xs text-muted-foreground">胜负</div>
            </div>
          </div>
        </div>
      )}

      {/* 排行榜列表 */}
      {entries.length === 0 ? (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-5xl text-muted-foreground mb-3 block">leaderboard</span>
          <p className="text-muted-foreground">还没有玩家上榜</p>
          <p className="text-xs text-muted-foreground mt-1">完成至少 5 局对战即可上榜</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isMe = entry.userId === myEntry?.userId;
            return (
              <div
                key={entry.userId}
                className={`flex items-center gap-3 p-3 rounded-xl ${isMe ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-surface-container'}`}
              >
                <span className={`font-headline font-extrabold text-lg w-8 text-center ${
                  entry.rank === 1 ? 'text-yellow-500' : entry.rank === 2 ? 'text-gray-400' : entry.rank === 3 ? 'text-orange-700' : 'text-muted-foreground'
                }`}>
                  {entry.rank}
                </span>
                <span className="text-2xl">{entry.avatar}</span>
                <div className="flex-1">
                  <div className="font-bold text-sm">{entry.username}{isMe && <span className="text-primary">（我）</span>}</div>
                  <div className="text-xs text-muted-foreground">
                    {(entry.avgAccuracy * 100).toFixed(1)}% · {(entry.avgTimeMs / 1000).toFixed(1)}s · {entry.wins}胜{entry.losses}负
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{entry.matchesPlayed}局</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
