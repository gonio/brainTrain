import { useState } from 'react';
import { useUserStore } from '../../stores/userStore';
import { useSettingsStore } from '../../stores/settingsStore';

interface NavBarProps {
  onStatsClick?: () => void;
  onSettingsClick?: () => void;
}

export function NavBar({ onStatsClick, onSettingsClick }: NavBarProps) {
  const { profile } = useUserStore();
  const { theme, setTheme } = useSettingsStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'auto' : 'light';
    setTheme(next);
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return '☀️';
      case 'dark':
        return '🌙';
      case 'auto':
        return '🌓';
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-4xl px-4">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-primary">Brain</span>
            <span>Train</span>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <a
              href="/"
              className="text-sm font-medium text-foreground/60 hover:text-foreground transition-colors"
            >
              训练
            </a>
            <button
              onClick={onStatsClick}
              className="text-sm font-medium text-foreground/60 hover:text-foreground transition-colors"
            >
              统计
            </button>
            <button
              onClick={onSettingsClick}
              className="text-sm font-medium text-foreground/60 hover:text-foreground transition-colors"
            >
              设置
            </button>
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="inline-flex items-center justify-center rounded-md w-9 h-9 hover:bg-accent transition-colors"
              title={`当前主题: ${theme === 'auto' ? '跟随系统' : theme === 'light' ? '浅色' : '深色'}`}
            >
              <span className="text-lg">{getThemeIcon()}</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent text-sm">
              <span>👤</span>
              <span className="font-medium">{profile?.displayName || '用户'}</span>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden inline-flex items-center justify-center rounded-md w-9 h-9 hover:bg-accent transition-colors"
            >
              <span className="text-lg">{isMenuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden border-t py-4">
            <nav className="flex flex-col gap-2">
              <a
                href="/"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-accent transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                训练
              </a>
              <button
                onClick={() => {
                  onStatsClick?.();
                  setIsMenuOpen(false);
                }}
                className="px-3 py-2 rounded-md text-sm font-medium text-left hover:bg-accent transition-colors"
              >
                统计
              </button>
              <button
                onClick={() => {
                  onSettingsClick?.();
                  setIsMenuOpen(false);
                }}
                className="px-3 py-2 rounded-md text-sm font-medium text-left hover:bg-accent transition-colors"
              >
                设置
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
