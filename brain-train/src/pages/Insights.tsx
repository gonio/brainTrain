import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { getTrainingRecords } from '../db/queries';
import { calculateStreak } from '../lib/stats';
import type { TrainingRecord } from '../types';

export function Insights() {
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const fetchedRecords = await getTrainingRecords();
      setRecords(fetchedRecords);
      setStreak(calculateStreak(fetchedRecords));
      setLoading(false);
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="py-8">
        <h1 className="font-headline text-2xl font-extrabold mb-6">训练洞察</h1>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 bg-surface-container rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="py-8">
        <h1 className="font-headline text-2xl font-extrabold mb-6">训练洞察</h1>
        <div className="p-8 text-center text-muted-foreground bg-surface-container rounded-2xl">
          <span className="material-symbols-outlined text-4xl mb-4 text-slate-300">insights</span>
          <p>还没有足够的数据</p>
          <p className="text-sm mt-2">完成更多训练后，我们会为你生成个性化洞察</p>
        </div>
      </div>
    );
  }

  // 计算最近7天的数据
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split('T')[0];
  }).reverse();

  const dailyData = last7Days.map(date => ({
    date,
    sessions: records.filter(r => r.startedAt.startsWith(date)).length,
  }));

  const totalSessions = records.length;
  const avgScore = records.reduce((sum, r) => sum + r.score, 0) / records.length;
  const bestDay = dailyData.reduce((max, d) => d.sessions > max.sessions ? d : max, dailyData[0]);

  return (
    <div className="py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-headline text-2xl font-extrabold mb-2">训练洞察</h1>
        <p className="text-sm text-muted-foreground">
          基于你的训练数据分析
        </p>
      </div>

      {/* 核心洞察卡片 */}
      <div className="space-y-4">
        {/* 连续训练 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-5 rounded-2xl"
        >
          <div className="flex items-start gap-4">
            <div className="text-4xl">🔥</div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">保持你的连胜！</h3>
              <p className="text-sm opacity-90">
                你已连续训练 <span className="font-bold text-xl">{streak.current}</span> 天。
                {streak.current >= streak.longest
                  ? '这是你目前的最高记录！'
                  : `距离最高记录 ${streak.longest} 天还有 ${streak.longest - streak.current} 天。`}
              </p>
            </div>
          </div>
        </motion.div>

        {/* 最佳表现日 */}
        {bestDay.sessions > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-r from-green-500 to-teal-500 text-white p-5 rounded-2xl"
          >
            <div className="flex items-start gap-4">
              <div className="text-4xl">⭐</div>
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-1">最佳训练日</h3>
                <p className="text-sm opacity-90">
                  {new Date(bestDay.date).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                  你完成了 <span className="font-bold text-xl">{bestDay.sessions}</span> 次训练，
                  这是你最近7天中表现最好的一天！
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* 平均水平 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-surface-container p-5 rounded-2xl"
        >
          <div className="flex items-start gap-4">
            <div className="text-4xl">📊</div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-2">训练表现</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold font-headline text-primary">
                    {Math.round(avgScore)}
                  </div>
                  <div className="text-xs text-muted-foreground">平均分数</div>
                </div>
                <div>
                  <div className="text-2xl font-bold font-headline text-primary">
                    {totalSessions}
                  </div>
                  <div className="text-xs text-muted-foreground">总训练次数</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 最近7天活动 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-surface-container p-5 rounded-2xl"
        >
          <h3 className="font-bold text-lg mb-4">最近7天活动</h3>
          <div className="flex items-end justify-between h-32 gap-2">
            {dailyData.map((day, index) => {
              const maxSessions = Math.max(...dailyData.map(d => d.sessions), 1);
              const height = day.sessions > 0 ? (day.sessions / maxSessions) * 100 : 10;
              const dayName = new Date(day.date).toLocaleDateString('zh-CN', { weekday: 'short' });

              return (
                <div key={day.date} className="flex-1 flex flex-col items-center">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    className={`w-full rounded-t-lg min-h-[4px] ${
                      day.sessions > 0 ? 'bg-primary' : 'bg-accent'
                    }`}
                  />
                  <div className="text-xs text-muted-foreground mt-2">{dayName}</div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* 建议 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-5 rounded-2xl"
        >
          <div className="flex items-start gap-4">
            <div className="text-4xl">💡</div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">训练建议</h3>
              <p className="text-sm opacity-90">
                {avgScore < 500
                  ? '建议从简单难度开始，逐步提升你的专注力水平。'
                  : avgScore < 800
                  ? '你的表现不错！尝试挑战更高难度以获得更好的训练效果。'
                  : '你的专注力水平很高！保持这个状态，定期进行训练。'}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
