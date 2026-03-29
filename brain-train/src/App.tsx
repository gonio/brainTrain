import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useUserStore } from './stores/userStore';
import { useSettingsStore } from './stores/settingsStore';
import { AppLayout } from './components/layout';
import { GameCard } from './components/game';
import { Stats } from './pages/Stats';
import { Insights } from './pages/Insights';
import { Settings } from './pages/Settings';
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
import type { TrainingMode } from './types';

const games: {
  mode: TrainingMode;
  title: string;
  titleEn: string;
  description: string;
  priority: 'P1' | 'P2' | 'P3';
  stat: string;
  statLabel: string;
  progress: number;
}[] = [
  {
    mode: 'schulte',
    title: '舒尔特表',
    titleEn: 'Schulte Table',
    description: '视觉搜索训练',
    priority: 'P1',
    stat: '12.4s',
    statLabel: 'Top',
    progress: 75
  },
  {
    mode: 'stroop',
    title: '字色干扰',
    titleEn: 'Stroop Effect',
    description: '抑制语义干扰',
    priority: 'P1',
    stat: '880',
    statLabel: '',
    progress: 50
  },
  {
    mode: 'sequence',
    title: '序列记忆',
    titleEn: 'Sequence Memory',
    description: '工作记忆训练',
    priority: 'P2',
    stat: '14',
    statLabel: 'Level',
    progress: 66
  },
  {
    mode: 'auditory',
    title: '听觉注意',
    titleEn: 'Auditory Attention',
    description: '听觉选择性注意',
    priority: 'P2',
    stat: 'New',
    statLabel: '',
    progress: 25
  },
  {
    mode: 'mirror',
    title: '镜像协调',
    titleEn: 'Mirror Coordination',
    description: '双侧肢体协调',
    priority: 'P3',
    stat: '94%',
    statLabel: 'High',
    progress: 83
  },
  {
    mode: 'classify',
    title: '分类逻辑',
    titleEn: 'Categorization Logic',
    description: '规则导向分类',
    priority: 'P3',
    stat: '1.2k',
    statLabel: '',
    progress: 40
  },
  {
    mode: 'story',
    title: '情景联想',
    titleEn: 'Scenario Association',
    description: '场景记忆联想',
    priority: 'P3',
    stat: 'New',
    statLabel: '',
    progress: 0
  }
];

function Home() {
  const navigate = useNavigate();

  const handleGameClick = (mode: TrainingMode) => {
    navigate(`/games/${mode}`);
  };

  return (
    <>
      {/* Welcome Section */}
      <section className="mb-10">
        <h1 className="font-headline text-4xl font-extrabold tracking-tight text-slate-900 mb-2">
          早上好，专注。
        </h1>
        <p className="text-slate-500 leading-relaxed font-medium">
          你今天的认知清晰度是 <span className="text-primary font-bold">84%</span>。准备好开始日常训练了吗？
        </p>
      </section>

      {/* Training Modes Grid */}
      <section className="mb-12">
        <div className="flex justify-between items-end mb-6">
          <h2 className="font-headline text-xl font-extrabold text-slate-900">训练模式</h2>
          <span className="text-[10px] text-primary font-black uppercase tracking-widest cursor-pointer hover:underline">
            查看全部
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {games.map((game) => (
            <GameCard
              key={game.mode}
              mode={game.mode}
              title={game.titleEn}
              description={game.description}
              priority={game.priority}
              stat={game.stat}
              statLabel={game.statLabel}
              progress={game.progress}
              onClick={() => handleGameClick(game.mode)}
            />
          ))}
        </div>
      </section>

      {/* Performance Insights */}
      <section className="mb-12">
        <h2 className="font-headline text-xl font-extrabold text-slate-900 mb-6">训练洞察</h2>
        <div className="bg-indigo-50/50 p-6 rounded-3xl space-y-8 border border-indigo-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-primary/70 uppercase tracking-[0.2em] font-black mb-1">
                平均专注度
              </p>
              <p className="text-4xl font-headline font-black text-primary">92.4</p>
            </div>
            <div className="w-14 h-14 bg-white shadow-lg rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined text-success text-3xl font-bold">trending_up</span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-600 font-bold">本周活跃度</p>
              <span className="text-[10px] text-primary font-bold bg-white px-2 py-1 rounded-md shadow-sm">
                +12% 环比
              </span>
            </div>
            <div className="flex items-end justify-between h-24 gap-3">
              <div className="w-full bg-primary/20 rounded-t-xl h-[40%] hover:bg-primary/30 transition-colors"></div>
              <div className="w-full bg-primary/20 rounded-t-xl h-[60%] hover:bg-primary/30 transition-colors"></div>
              <div className="w-full bg-primary/20 rounded-t-xl h-[30%] hover:bg-primary/30 transition-colors"></div>
              <div className="w-full bg-primary rounded-t-xl h-[80%] shadow-lg shadow-primary/20"></div>
              <div className="w-full bg-secondary rounded-t-xl h-[55%] shadow-lg shadow-secondary/20"></div>
              <div className="w-full bg-primary/20 rounded-t-xl h-[45%] hover:bg-primary/30 transition-colors"></div>
              <div className="w-full bg-primary/20 rounded-t-xl h-[90%] hover:bg-primary/30 transition-colors"></div>
            </div>
            <div className="flex justify-between text-[9px] uppercase tracking-tighter font-black text-slate-400">
              <span>周一</span>
              <span>周二</span>
              <span>周三</span>
              <span>周四</span>
              <span>周五</span>
              <span>周六</span>
              <span>周日</span>
            </div>
          </div>
        </div>
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
