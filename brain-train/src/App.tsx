import { createBrowserRouter, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUserStore } from './stores/userStore';
import { useSettingsStore } from './stores/settingsStore';
import { AppLayout } from './components/layout';
import { GameCard } from './components/game';
import { Stats } from './pages/Stats';
import { Insights } from './pages/Insights';
import { Settings } from './pages/Settings';
import Profile from './pages/Profile';
import { Schulte } from './pages/games/Schulte';
import { Stroop } from './pages/games/Stroop';
import { Sequence } from './pages/games/Sequence';
import { Bottle } from './pages/games/Bottle';
import { Quest } from './pages/Quest';
import { ErrorBoundary } from './components/error-boundary/ErrorBoundary';
import { Onboarding } from './components/onboarding/Onboarding';
import { getGreeting } from './lib/greeting';
import { getTrainingRecords, getUserProfile } from './db/queries';
import { calculateStreak, calculateOverallStats } from './lib/stats';
import type { TrainingMode, TrainingRecord } from './types';

const games: {
  mode: TrainingMode;
  title: string;
  description: string;
  priority: 'P1' | 'P2' | 'P3';
}[] = [
  {
    mode: 'schulte',
    title: '舒尔特表',
    description: '视觉搜索训练',
    priority: 'P1',
  },
  {
    mode: 'stroop',
    title: '字色干扰',
    description: '抑制语义干扰',
    priority: 'P1',
  },
  {
    mode: 'sequence',
    title: '序列记忆',
    description: '工作记忆训练',
    priority: 'P2',
  },
  {
    mode: 'bottle',
    title: '暗瓶排列',
    description: '隐藏推理训练',
    priority: 'P2',
  },
];

// 计算本周训练数据（最近7天）
function getWeeklyData(records: TrainingRecord[]) {
  const today = new Date();
  const weekData = [];
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const dayRecords = records.filter(r => r.startedAt.startsWith(dateStr));
    const totalScore = dayRecords.reduce((sum, r) => sum + r.score, 0);
    const avgScore = dayRecords.length > 0 ? totalScore / dayRecords.length : 0;

    weekData.push({
      day: dayNames[date.getDay()],
      score: avgScore,
      sessions: dayRecords.length
    });
  }

  return weekData;
}

function Home() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [displayName, setDisplayName] = useState('用户');
  const [streak, setStreak] = useState(0);
  const [avgScore, setAvgScore] = useState(0);
  const [weeklyData, setWeeklyData] = useState<{day: string; score: number; sessions: number}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const [fetchedRecords, profile] = await Promise.all([
        getTrainingRecords(),
        getUserProfile(),
      ]);
      setRecords(fetchedRecords);
      setDisplayName(profile.displayName || '用户');

      const streakData = calculateStreak(fetchedRecords);
      setStreak(streakData.current);

      const stats = calculateOverallStats(fetchedRecords);
      setAvgScore(stats.avgScore);

      setWeeklyData(getWeeklyData(fetchedRecords));
      setLoading(false);
    };

    loadData();
  }, []);

  const handleGameClick = (mode: TrainingMode) => {
    navigate(`/games/${mode}`);
  };

  const maxWeeklyScore = Math.max(...weeklyData.map(d => d.score), 100);

  return (
    <>
      {/* Welcome Section */}
      <section className="mb-10">
        <h1 className="font-headline text-4xl font-extrabold tracking-tight text-foreground mb-2">
          {getGreeting()}，{displayName}
        </h1>
        <p className="text-muted-foreground leading-relaxed font-medium">
          {records.length === 0
            ? '开始你的第一次专注力训练吧！'
            : `已连续训练 ${streak} 天，继续加油！`}
        </p>
      </section>

      {/* 主线闯关入口 */}
      <section className="mb-8">
        <button
          onClick={() => navigate('/quest')}
          className="w-full p-6 bg-gradient-to-br from-primary/90 to-primary text-primary-foreground rounded-3xl text-left hover:opacity-95 transition-opacity shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-headline text-2xl font-extrabold mb-1">主线闯关</h2>
              <p className="text-primary-foreground/80 text-sm">4 个游戏随机串联，由易到难，40 关挑战</p>
            </div>
            <span className="material-symbols-outlined text-4xl">arrow_forward</span>
          </div>
        </button>
      </section>

      {/* Training Modes Grid */}
      <section className="mb-12">
        <div className="flex justify-between items-end mb-6">
          <h2 className="font-headline text-xl font-extrabold text-foreground">训练模式</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {games.map((game) => (
            <GameCard
              key={game.mode}
              mode={game.mode}
              title={game.title}
              description={game.description}
              priority={game.priority}
              onClick={() => handleGameClick(game.mode)}
            />
          ))}
        </div>
      </section>

      {/* Performance Insights */}
      <section className="mb-12">
        <h2 className="font-headline text-xl font-extrabold text-foreground mb-6">训练洞察</h2>
        {loading ? (
          <div className="bg-surface-container p-6 rounded-2xl animate-pulse h-64"></div>
        ) : records.length === 0 ? (
          <div className="bg-surface-container p-6 rounded-2xl text-center">
            <span className="material-symbols-outlined text-4xl mb-4 text-muted-foreground">analytics</span>
            <p className="text-foreground font-medium">还没有训练记录</p>
            <p className="text-sm text-muted-foreground mt-2">完成训练后，这里会显示你的统计数据</p>
          </div>
        ) : (
          <div className="bg-accent/30 p-6 rounded-3xl space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-primary/70 uppercase tracking-[0.2em] font-black mb-1">
                  平均专注度
                </p>
                <p className="text-4xl font-headline font-black text-primary">
                  {Math.round(avgScore)}
                </p>
              </div>
              <div className="w-14 h-14 bg-surface shadow-lg rounded-2xl flex items-center justify-center">
                <span className="material-symbols-outlined text-success text-3xl font-bold">trending_up</span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-bold">本周活跃度</p>
                <span className="text-xs text-primary font-bold bg-surface px-2 py-1 rounded-md shadow-sm">
                  {streak > 0 ? `连续 ${streak} 天` : '开始训练'}
                </span>
              </div>
              <div className="flex items-end justify-between h-24 gap-3">
                {weeklyData.map((day, _index) => (
                  <div key={day.day} className="flex flex-col items-center flex-1">
                    <div
                      className={`w-full rounded-t-xl transition-colors ${
                        day.sessions > 0 ? 'bg-primary' : 'bg-primary/20'
                      }`}
                      style={{ height: `${Math.max(10, (day.score / maxWeeklyScore) * 100)}%` }}
                    ></div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs uppercase tracking-tighter font-black text-muted-foreground">
                {weeklyData.map(day => (
                  <span key={day.day}>{day.day}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

    </>
  );
}

// 根布局：主题管理、错误边界、应用布局、页面过渡动画
function RootLayout() {
  const { loadProfile } = useUserStore();
  const { theme } = useSettingsStore();
  const location = useLocation();

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // 应用主题
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'auto') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  // 监听系统主题变化
  useEffect(() => {
    if (theme !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  return (
    <ErrorBoundary>
      <AppLayout>
        <AnimatePresence>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            // 不设 exit：data router 下 <Outlet/> 在导航时同步切到新路由，
            // exit 动画期间渲染的已是新内容，会出现「新内容先显示→淡出→再淡入」的闪烁。
            // 改为纯淡入：旧页面瞬时卸载，新页面从透明淡入，干脆不闪。
            transition={{
              duration: 0.15,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
        <Onboarding />
      </AppLayout>
    </ErrorBoundary>
  );
}

// 路由配置
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'quest', element: <Quest /> },
      { path: 'stats', element: <Stats /> },
      { path: 'insights', element: <Insights /> },
      { path: 'settings', element: <Settings /> },
      { path: 'profile', element: <Profile /> },
      { path: 'games/schulte', element: <Schulte /> },
      { path: 'games/stroop', element: <Stroop /> },
      { path: 'games/sequence', element: <Sequence /> },
      { path: 'games/bottle', element: <Bottle /> },
      { path: '*', element: <div className="py-8 text-center">页面未找到</div> },
    ]
  }
]);
