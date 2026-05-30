import { motion } from 'framer-motion';
import { useSettingsStore } from '../stores/settingsStore';
import { cn } from '../lib/utils';
import type { Theme } from '../types';

// 主题选项
const themeOptions: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: '浅色', icon: '☀️' },
  { value: 'dark', label: '深色', icon: '🌙' },
  { value: 'auto', label: '自动', icon: '🌓' },
];

// 每日目标选项（次数）
const goalOptions = [3, 5, 8, 10, 15];

export function Settings() {
  const {
    theme,
    soundEnabled,
    ttsEnabled,
    dailyGoalSessions,
    setTheme,
    toggleSound,
    toggleTTS,
    setDailyGoalSessions,
  } = useSettingsStore();

  return (
    <div className="py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-headline text-2xl font-extrabold mb-2">设置</h1>
        <p className="text-sm text-muted-foreground">
          自定义你的训练体验
        </p>
      </div>

      {/* 外观设置 */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <h2 className="font-headline text-lg font-bold">外观</h2>
        <div className="bg-surface-container p-4 rounded-2xl space-y-4">
          <div>
            <label className="text-sm font-medium mb-3 block">主题</label>
            <div className="grid grid-cols-3 gap-3">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    'p-3 rounded-xl text-center transition-all border-2',
                    theme === option.value
                      ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20'
                      : 'bg-surface-container border-border hover:bg-surface-container-high'
                  )}
                >
                  <div className="text-2xl mb-1">{option.icon}</div>
                  <div className="text-xs font-medium">{option.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* 声音设置 */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        <h2 className="font-headline text-lg font-bold">声音</h2>
        <div className="bg-surface-container p-4 rounded-2xl space-y-3">
          {/* 音效开关 */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-lg">
                🔊
              </div>
              <div>
                <div className="font-medium">音效</div>
                <div className="text-xs text-muted-foreground">训练中的声音反馈</div>
              </div>
            </div>
            <button
              onClick={toggleSound}
              className={cn(
                'w-14 h-8 rounded-full transition-colors relative',
                soundEnabled ? 'bg-primary' : 'bg-accent'
              )}
            >
              <motion.div
                className="w-6 h-6 bg-white rounded-full absolute top-1"
                animate={{ left: soundEnabled ? '26px' : '4px' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          {/* TTS 开关 */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-lg">
                🗣️
              </div>
              <div>
                <div className="font-medium">语音朗读</div>
                <div className="text-xs text-muted-foreground">文字转语音功能</div>
              </div>
            </div>
            <button
              onClick={toggleTTS}
              className={cn(
                'w-14 h-8 rounded-full transition-colors relative',
                ttsEnabled ? 'bg-primary' : 'bg-accent'
              )}
            >
              <motion.div
                className="w-6 h-6 bg-white rounded-full absolute top-1"
                animate={{ left: ttsEnabled ? '26px' : '4px' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        </div>
      </motion.section>

      {/* 训练设置 */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        <h2 className="font-headline text-lg font-bold">训练</h2>

        {/* 每日目标 */}
        <div className="bg-surface-container p-4 rounded-2xl">
          <label className="text-sm font-medium mb-3 block">每日训练目标</label>
          <div className="grid grid-cols-5 gap-2">
            {goalOptions.map((sessions) => (
              <button
                key={sessions}
                onClick={() => setDailyGoalSessions(sessions)}
                className={cn(
                  'p-3 rounded-xl text-center transition-all border-2',
                  dailyGoalSessions === sessions
                    ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20'
                    : 'bg-surface-container border-border hover:bg-surface-container-high'
                )}
              >
                <div className="text-lg font-bold font-headline">{sessions}</div>
                <div className="text-xs">次</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            设置每日目标帮助你保持训练习惯。所有训练固定为困难模式，不提供难度选择。
          </p>
        </div>
      </motion.section>

      {/* 关于 */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-4"
      >
        <h2 className="font-headline text-lg font-bold">关于</h2>
        <div className="bg-surface-container p-4 rounded-2xl">
          <div className="text-center py-4">
            <div className="text-4xl mb-2">🧠</div>
            <div className="font-bold text-lg">BrainTrain</div>
            <div className="text-sm text-muted-foreground">专注力训练应用</div>
            <div className="text-xs text-muted-foreground mt-1">版本 1.0.0</div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
