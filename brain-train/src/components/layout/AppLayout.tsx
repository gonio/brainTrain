import type { ReactNode } from 'react';
import { TopBar, BottomNav } from './BottomNav';
import { PWAInstallPrompt } from '../PWAInstallPrompt';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <TopBar />
      <main className="max-w-md mx-auto px-6 pt-6">{children}</main>
      <BottomNav />
      <PWAInstallPrompt />
    </div>
  );
}
