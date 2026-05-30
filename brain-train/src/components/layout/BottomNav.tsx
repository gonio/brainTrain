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
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-background/95 backdrop-blur-xl border-t border-border transition-all">
      <div className="max-w-md mx-auto flex flex-col w-full">
        <div className="flex justify-around items-center px-4 pt-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex flex-col items-center justify-center px-4 py-2 rounded-2xl transition-all duration-300
                  ${isActive
                    ? 'bg-accent text-primary scale-110'
                    : 'text-muted-foreground hover:text-primary'
                  }
                `}
              >
                <span className={`material-symbols-outlined text-2xl ${isActive ? 'font-bold' : ''}`}>
                  {item.icon}
                </span>
                <span className="font-headline text-xs uppercase tracking-widest font-bold mt-1">
                  {item.labelZh}
                </span>
              </Link>
            );
          })}
        </div>
        <div className="flex justify-center pb-2 pt-1">
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors font-sans"
          >
            粤ICP备2026057219号
          </a>
        </div>
      </div>
    </nav>
  );
}

export function TopBar() {
  const { profile } = useUserStore();
  const { dailyGoalSessions } = useSettingsStore();
  const [todaySessions, setTodaySessions] = useState(0);
  const streak = profile?.currentStreak || 0;

  // 加载今日训练次数
  useEffect(() => {
    const loadTodayProgress = async () => {
      const records = await getTodayTrainingRecords();
      setTodaySessions(records.length);
    };

    loadTodayProgress();
    // 每分钟刷新一次
    const interval = setInterval(loadTodayProgress, 60000);
    return () => clearInterval(interval);
  }, []);

  const progressPercent = Math.min(100, (todaySessions / dailyGoalSessions) * 100);
  const isGoalCompleted = todaySessions >= dailyGoalSessions;

  return (
    <header className="sticky top-0 z-50 w-full bg-background/85 backdrop-blur-xl border-b border-border">
      <div className="max-w-md mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          {/* 左侧：用户头像和进度 - 可点击跳转个人资料 */}
          <Link to="/profile" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
                {profile?.avatar?.startsWith('data:image') ? (
                  <img src={profile.avatar} alt="头像" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <span className="text-lg">{profile?.avatar || '👤'}</span>
                )}
              </div>
              {/* 连续训练徽章 */}
              {streak > 0 && (
                <div className="absolute -bottom-0.5 -right-0.5 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full font-extrabold shadow-sm flex items-center gap-0.5">
                  <span>🔥</span>
                  <span>{streak}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-headline font-bold text-xl tracking-tight text-primary">
                {profile?.displayName || '用户'}
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
                <span className="text-xs text-muted-foreground font-medium">
                  {todaySessions}/{dailyGoalSessions}次
                </span>
                {isGoalCompleted && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-xs"
                    title="今日目标已完成"
                  >
                    ✓
                  </motion.span>
                )}
              </div>
            </div>
          </Link>

          {/* 右侧：快捷操作 */}
          <Link
            to="/stats"
            className="p-2 rounded-full hover:bg-accent transition-colors active:scale-95"
          >
            <span className="material-symbols-outlined text-primary">analytics</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
