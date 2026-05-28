import { useState, useEffect } from 'react';
import { useNavigate, useBlocker } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface GameControlBarProps {
  title: string;
  showTimer?: boolean;
  elapsedTime?: number;
}

export function GameControlBar({ title, showTimer = false, elapsedTime = 0 }: GameControlBarProps) {
  const navigate = useNavigate();
  const { status, pauseGame, resumeGame, abandonGame } = useGameStore();
  const [showPauseMenu, setShowPauseMenu] = useState(false);

  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';

  // 使用 useBlocker 拦截路由导航
  const blocker = useBlocker(isPlaying || isPaused);

  useEffect(() => {
    if (blocker.state === 'blocked') {
      pauseGame();
      setShowPauseMenu(true);
      blocker.reset();
    }
  }, [blocker, pauseGame]);

  const handlePause = () => {
    pauseGame();
    setShowPauseMenu(true);
  };

  const handleResume = () => {
    resumeGame();
    setShowPauseMenu(false);
  };

  const handleExit = () => {
    setShowPauseMenu(false);
    abandonGame();
    navigate('/');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 只有在 playing 或 paused 状态才显示控制栏
  if (!isPlaying && !isPaused) {
    return null;
  }

  return (
    <>
      {/* 固定顶部控制栏 */}
      <motion.div
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        exit={{ y: -100 }}
        className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border"
      >
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* 左侧：返回/退出按钮 */}
          <button
            onClick={handlePause}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="text-lg">←</span>
            <span className="hidden sm:inline">暂停</span>
          </button>

          {/* 中间：标题和计时器 */}
          <div className="flex flex-col items-center">
            <span className="font-semibold text-sm">{title}</span>
            {showTimer && (
              <span className="text-xs text-muted-foreground font-mono">
                {formatTime(elapsedTime)}
              </span>
            )}
          </div>

          {/* 右侧：暂停按钮 */}
          <button
            onClick={handlePause}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            <span className="text-primary text-sm">⏸</span>
          </button>
        </div>
      </motion.div>

      {/* 暂停菜单弹窗 */}
      <Dialog open={showPauseMenu} onOpenChange={setShowPauseMenu}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>游戏暂停</DialogTitle>
            <DialogDescription>
              训练已暂停，选择继续或退出
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-4">
            <Button onClick={handleResume} className="w-full">
              继续训练
            </Button>
            <Button onClick={handleExit} variant="outline" className="w-full">
              退出训练
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 顶部占位符，防止内容被固定栏遮挡 */}
      <div className="h-14" />
    </>
  );
}
