import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useUserStore } from '../../stores/userStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getTodayTrainingRecords } from '../../db/queries';
import { motion } from 'framer-motion';

const navItems = [
  { path: '/', icon: 'psychology', label: 'Training', labelZh: '训练' },
  { path: '/stats', icon: 'analytics', label: 'Progress', labelZh: '统计' },
  { path: '/insights', icon: 'insights', label: 'Insights', labelZh: '洞察' },
  { path: '/settings', icon: 'settings', label: 'Settings', labelZh: '设置' }
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-surface/85 dark:bg-slate-900/85 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 transition-all">
      <div className="max-w-md mx-auto flex justify-around items-center px-4 pb-6 pt-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex flex-col items-center justify-center px-4 py-2 rounded-2xl transition-all duration-300
                ${isActive
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-primary scale-110'
                  : 'text-muted-foreground hover:text-primary'
                }
              `}
            >
              <span className={`material-symbols-outlined text-2xl ${isActive ? 'font-bold' : ''}`}>
                {item.icon}
              </span>
              <span className="font-headline text-[10px] uppercase tracking-widest font-bold mt-1">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function TopBar() {
  const { profile } = useUserStore();
  const { dailyGoalMinutes } = useSettingsStore();
  const [todayMinutes, setTodayMinutes] = useState(0);
  const streak = profile?.currentStreak || 0;

  // 加载今日训练时间
  useEffect(() => {
    const loadTodayProgress = async () => {
      const records = await getTodayTrainingRecords();
      const totalSeconds = records.reduce((sum, r) => sum + r.duration, 0);
      setTodayMinutes(Math.round(totalSeconds / 60));
    };

    loadTodayProgress();
    // 每分钟刷新一次
    const interval = setInterval(loadTodayProgress, 60000);
    return () => clearInterval(interval);
  }, []);

  const progressPercent = Math.min(100, (todayMinutes / dailyGoalMinutes) * 100);
  const isGoalCompleted = todayMinutes >= dailyGoalMinutes;

  return (
    <header className="sticky top-0 z-50 w-full bg-background/85 backdrop-blur-xl">
      <div className="max-w-md mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          {/* 左侧：用户头像和进度 */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
                <span className="material-symbols-outlined text-primary">person</span>
              </div>
              {/* 连续训练徽章 */}
              {streak > 0 && (
                <div className="absolute -bottom-0.5 -right-0.5 bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-extrabold shadow-sm flex items-center gap-0.5">
                  <span>🔥</span>
                  <span>{streak}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-headline font-bold text-xl tracking-tight text-primary">
                BrainTrain
              </span>
              {/* 每日目标进度条 */}
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-accent rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${isGoalCompleted ? 'bg-success' : 'bg-primary'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {todayMinutes}/{dailyGoalMinutes}分钟
                </span>
                {isGoalCompleted && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-[10px]"
                    title="今日目标已完成"
                  >
                    ✓
                  </motion.span>
                )}
              </div>
            </div>
          </div>

          {/* 右侧：快捷操作 */}
          <Link
            to="/stats"
            className="p-2 rounded-full hover:bg-slate-200/50 transition-colors active:scale-95"
          >
            <span className="material-symbols-outlined text-primary">analytics</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
