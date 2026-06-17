import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getTrainingRecords, getUserProfile } from '../db/queries';
import { useStats } from '../hooks/useStats';
import { calculateStreak } from '../lib/stats';
import type { TrainingRecord, TrainingMode, ModeStatistics } from '../types';

// 训练模式名称映射
const modeNames: Record<TrainingMode, string> = {
  schulte: '舒尔特表',
  stroop: '字色干扰',
  sequence: '序列记忆',
  bottle: '暗瓶排列',
};

// 训练模式图标
const modeIcons: Record<TrainingMode, string> = {
  schulte: '🔢',
  stroop: '🎨',
  sequence: '🧠',
  bottle: '🍾',
};

export function Stats() {
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [dailyGoal, setDailyGoal] = useState(5);

  const stats = useStats(records);

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      const [fetchedRecords, profile] = await Promise.all([
        getTrainingRecords(),
        getUserProfile(),
      ]);
      setRecords(fetchedRecords);
      setDailyGoal(profile.preferences.dailyGoalSessions);
      setStreak(calculateStreak(fetchedRecords));
      setLoading(false);
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="py-8">
        <h1 className="font-headline text-2xl font-extrabold mb-6">训练统计</h1>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-surface-container rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="py-8">
        <h1 className="font-headline text-2xl font-extrabold mb-6">训练统计</h1>
        <div className="p-8 text-center text-muted-foreground bg-surface-container rounded-2xl">
          <span className="material-symbols-outlined text-4xl mb-4 text-slate-300">analytics</span>
          <p>还没有训练记录</p>
          <p className="text-sm mt-2">开始训练后，这里会显示你的统计数据</p>
        </div>
      </div>
    );
  }

  // 计算今日训练次数
  const today = new Date().toISOString().split('T')[0];
  const todayRecords = records.filter((r) => r.startedAt.startsWith(today));
  const todaySessions = todayRecords.length;

  return (
    <div className="py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-headline text-2xl font-extrabold mb-2">训练统计</h1>
        <p className="text-sm text-muted-foreground">
          追踪你的训练进度和成就
        </p>
      </div>

      {/* 总体概览卡片 */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-5 rounded-2xl"
        >
          <div className="text-xs uppercase tracking-wider opacity-80 mb-1">总训练次数</div>
          <div className="text-3xl font-bold font-headline">{stats.overall.totalSessions}</div>
          <div className="text-xs opacity-70 mt-1">次训练</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground p-5 rounded-2xl"
        >
          <div className="text-xs uppercase tracking-wider opacity-80 mb-1">今日训练</div>
          <div className="text-3xl font-bold font-headline">
            {todaySessions}
          </div>
          <div className="text-xs opacity-70 mt-1">次</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-surface-container p-5 rounded-2xl"
        >
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">平均分数</div>
          <div className="text-3xl font-bold font-headline text-foreground">
            {Math.round(stats.overall.avgScore)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">分</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-surface-container p-5 rounded-2xl"
        >
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">平均准确率</div>
          <div className="text-3xl font-bold font-headline text-foreground">
            {Math.round(stats.overall.avgAccuracy)}%
          </div>
          <div className="text-xs text-muted-foreground mt-1">准确率</div>
        </motion.div>
      </div>

      {/* 连续训练天数 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gradient-to-r from-orange-400 to-pink-500 text-white p-5 rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider opacity-80 mb-1">连续训练</div>
            <div className="text-4xl font-bold font-headline">{streak.current}</div>
            <div className="text-xs opacity-80 mt-1">天连续训练</div>
          </div>
          <div className="text-right">
            <div className="text-3xl">🔥</div>
            <div className="text-xs opacity-80 mt-1">最高 {streak.longest} 天</div>
          </div>
        </div>
      </motion.div>

      {/* 今日目标 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-surface-container p-5 rounded-2xl"
      >
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium">今日目标</span>
          <span className="text-sm text-muted-foreground">
            {todaySessions} / {dailyGoal} 次
          </span>
        </div>
        <div className="h-3 bg-accent rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (todaySessions / dailyGoal) * 100)}%` }}
            transition={{ duration: 0.5, delay: 0.6 }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {todaySessions >= dailyGoal
            ? '🎉 今日目标已完成！'
            : `还需要 ${dailyGoal - todaySessions} 次达到目标`}
        </p>
      </motion.div>

      {/* 各模式统计 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <h2 className="font-headline text-lg font-bold mb-4">各模式统计</h2>
        <div className="space-y-3">
          {(Object.entries(stats.byMode) as [TrainingMode, ModeStatistics][])
            .filter(([, modeStats]) => modeStats.sessions > 0)
            .sort(([, a], [, b]) => b.sessions - a.sessions)
            .map(([mode, modeStats], index) => (
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                className="bg-surface-container p-4 rounded-xl flex items-center gap-4"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-2xl">
                  {modeIcons[mode as TrainingMode]}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{modeNames[mode as TrainingMode]}</div>
                  <div className="text-xs text-muted-foreground">
                    {modeStats.sessions} 次训练
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold font-headline">
                    {Math.round(modeStats.avgScore)}
                  </div>
                  <div className="text-xs text-muted-foreground">平均分</div>
                </div>
              </motion.div>
            ))}
        </div>
      </motion.div>

      {/* 最近训练 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <h2 className="font-headline text-lg font-bold mb-4">最近训练</h2>
        <div className="space-y-2">
          {records.slice(0, 5).map((record, index) => (
            <motion.div
              key={record.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9 + index * 0.05 }}
              className="bg-surface-container p-3 rounded-xl flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{modeIcons[record.mode]}</span>
                <div>
                  <div className="text-sm font-medium">{modeNames[record.mode]}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(record.startedAt).toLocaleDateString('zh-CN')}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold">{record.score} 分</div>
                <div className="text-xs text-muted-foreground">{record.accuracy}% 准确</div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
