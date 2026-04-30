import { useEffect, useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

// 监听系统主题变化并计算实际应用的主题
export function useTheme() {
  const { theme } = useSettingsStore();
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateTheme = () => {
      if (theme === 'auto') {
        setEffectiveTheme(mediaQuery.matches ? 'dark' : 'light');
      } else {
        setEffectiveTheme(theme);
      }
    };

    // 初始设置
    updateTheme();

    // 监听系统主题变化
    const handler = (e: MediaQueryListEvent) => {
      if (theme === 'auto') {
        setEffectiveTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  return { theme, effectiveTheme };
}
