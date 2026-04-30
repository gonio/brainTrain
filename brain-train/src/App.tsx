import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
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
import { Auditory } from './pages/games/Auditory';
import { Mirror } from './pages/games/Mirror';
import { Classify } from './pages/games/Classify';
import { Story } from './pages/games/Story';
import { ErrorBoundary } from './components/error-boundary/ErrorBoundary';
import { PageTransition } from './components/animations/PageTransition';
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
    mode: 'auditory',
    title: '听觉注意',
    description: '听觉选择性注意',
    priority: 'P2',
  },
  {
    mode: 'mirror',
    title: '镜像协调',
    description: '双侧肢体协调',
    priority: 'P3',
  },
  {
    mode: 'classify',
    title: '分类逻辑',
    description: '规则导向分类',
    priority: 'P3',
  },
  {
    mode: 'story',
    title: '情景联想',
    description: '场景记忆联想',
    priority: 'P3',
  }
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
                <p className="text-[10px] text-primary/70 uppercase tracking-[0.2em] font-black mb-1">
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
                <span className="text-[10px] text-primary font-bold bg-surface px-2 py-1 rounded-md shadow-sm">
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
              <div className="flex justify-between text-[9px] uppercase tracking-tighter font-black text-muted-foreground">
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

function App() {
  const { loadProfile } = useUserStore();
  const { theme } = useSettingsStore();
  const location = useLocation();

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

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
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/games/schulte" element={<Schulte />} />
              <Route path="/games/stroop" element={<Stroop />} />
              <Route path="/games/sequence" element={<Sequence />} />
              <Route path="/games/auditory" element={<Auditory />} />
              <Route path="/games/mirror" element={<Mirror />} />
              <Route path="/games/classify" element={<Classify />} />
              <Route path="/games/story" element={<Story />} />
              <Route path="*" element={<div className="py-8 text-center">页面未找到</div>} />
            </Routes>
          </PageTransition>
        </AnimatePresence>
        <Onboarding />
      </AppLayout>
    </ErrorBoundary>
  );
}

export default App;
