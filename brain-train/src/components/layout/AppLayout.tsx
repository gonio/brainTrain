import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { TopBar, BottomNav } from './BottomNav';
import { PWAInstallPrompt } from '../PWAInstallPrompt';
import { useGameStore } from '../../stores/gameStore';

interface AppLayoutProps {
  children: ReactNode;
}

// 游戏路径列表
const GAME_PATHS = ['/games/schulte', '/games/stroop', '/games/sequence'];

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const { status } = useGameStore();

  // 检查是否在游戏页面
  const isGamePage = GAME_PATHS.some(path => location.pathname.startsWith(path));

  // 在游戏进行中隐藏导航
  const isPlaying = status === 'playing' || status === 'paused';
  const hideNav = isGamePage && isPlaying;

  return (
    <div className={`min-h-screen bg-background text-foreground ${!hideNav ? 'pb-24' : ''}`}>
      {!hideNav && <TopBar />}
      <main className={`max-w-md mx-auto px-6 ${hideNav ? 'pt-0' : 'pt-6'}`}>{children}</main>
      {!hideNav && <BottomNav />}
      <PWAInstallPrompt />
    </div>
  );
}
