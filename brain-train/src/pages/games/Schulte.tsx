import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAudio } from '../../hooks/useAudio';
import { SchulteGrid } from '../../components/game/SchulteGrid';
import { ScoreBoard } from '../../components/game/ScoreBoard';
import { GameControlBar } from '../../components/game/GameControlBar';
import { GameStartScreen } from '../../components/game/GameStartScreen';
import type { TrainingDetails } from '../../types';

// 固定5x5配置
const GRID_SIZE = 5;
const GRID_ORDER = 'asc' as const;

export function Schulte() {
  const { startGame, endGame, status } = useGameStore();
  const { soundEnabled } = useSettingsStore();
  const { playEffect } = useAudio();

  const [gameStartTime, setGameStartTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [errors, setErrors] = useState(0);
  const [clickSequence, setClickSequence] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const isIdle = status === 'idle';

  // Timer update
  useEffect(() => {
    if (!isPlaying || gameStartTime === 0) return;

    const interval = setInterval(() => {
      setElapsedTime((Date.now() - gameStartTime) / 1000);
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, gameStartTime]);

  const handleStart = useCallback(() => {
    startGame('schulte');
    setGameStartTime(Date.now());
    setElapsedTime(0);
    setErrors(0);
    setClickSequence([]);
    setShowResult(false);
    setFinalScore(0);
  }, [startGame]);

  const handleCorrectClick = useCallback((_number: number, _time: number) => {
    setClickSequence(prev => [...prev, _number]);
    if (soundEnabled) {
      playEffect('tick');
    }
  }, [soundEnabled, playEffect]);

  const handleWrongClick = useCallback(() => {
    setErrors(prev => prev + 1);
    if (soundEnabled) {
      playEffect('wrong');
    }
  }, [soundEnabled, playEffect]);

  // 此函数由 SchulteGrid 组件在游戏完成时调用
  const handleComplete = useCallback(() => {
    const endTime = Date.now();
    const totalTime = (endTime - gameStartTime) / 1000;

    // 0-100 分制：准确度 70% + 速度 30%
    const maxNumber = GRID_SIZE * GRID_SIZE;
    const accuracyScore = ((maxNumber - errors) / maxNumber) * 100;
    const speedScore = Math.max(0, 100 - (totalTime - 20) * 2);
    const score = Math.min(100, Math.round(accuracyScore * 0.7 + speedScore * 0.3));

    const accuracy = Math.round(((maxNumber - errors) / maxNumber) * 100);

    const details: TrainingDetails = {
      gridSize: GRID_SIZE,
      order: GRID_ORDER,
      completionTime: totalTime,
      errorCount: errors,
      clickSequence
    };

    endGame({
      score,
      accuracy,
      details
    });

    setFinalScore(score);
    setShowResult(true);

    if (soundEnabled) {
      playEffect('complete');
    }
  }, [gameStartTime, errors, clickSequence, endGame, soundEnabled, playEffect]);

  return (
    <>
      {/* 游戏控制栏 - 游戏进行中显示 */}
      <GameControlBar
        title="舒尔特表"
        showTimer={isPlaying}
        elapsedTime={Math.floor(elapsedTime)}
      />

      <div className="max-w-2xl mx-auto px-6 pt-4 pb-32 flex flex-col" style={{ minHeight: 'calc(100vh - 140px)' }}>
        {/* 游戏开始页面 */}
        {isIdle && !showResult && (
          <GameStartScreen
            mode="schulte"
            title="舒尔特表"
            description="按顺序点击数字1-25，训练视觉搜索能力"
            onStart={handleStart}
          />
        )}

        {/* Game Grid - 占据剩余空间 */}
        <div className="flex-1 flex flex-col justify-start py-4">
          <SchulteGrid
            order={GRID_ORDER}
            onCorrectClick={handleCorrectClick}
            onWrongClick={handleWrongClick}
            onComplete={handleComplete}
            isActive={isPlaying}
            startTime={gameStartTime}
          />
        </div>

        {/* Metrics - Target, Accuracy, Avg Speed */}
        {(isPlaying || isPaused) && (
          <div className="mb-8 flex justify-center gap-12">
            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">目标</span>
              <span className="text-secondary text-2xl font-bold font-headline">
                {String(clickSequence.length + 1).padStart(2, '0')}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">准确率</span>
              <span className="text-foreground text-2xl font-bold font-headline">
                {clickSequence.length > 0
                  ? Math.round((clickSequence.length / (clickSequence.length + errors)) * 100)
                  : 100}%
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">错误</span>
              <span className="text-foreground text-2xl font-bold font-headline">{errors}</span>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-4">
          {showResult && (
            <motion.button
              onClick={handleStart}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-lg"
            >
              再玩一次
            </motion.button>
          )}
        </div>

        {/* Result Modal */}
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 p-6 bg-surface-container-low rounded-2xl border border-border"
          >
            <h3 className="text-lg font-semibold mb-4 text-center font-headline">训练完成！</h3>
            <ScoreBoard
              score={finalScore}
              accuracy={Math.round(((GRID_SIZE * GRID_SIZE - errors) / (GRID_SIZE * GRID_SIZE)) * 100)}
            />
            <div className="mt-4 text-center text-sm text-muted-foreground space-y-1">
              <p>用时: {elapsedTime.toFixed(2)}秒</p>
              <p>错误: {errors}</p>
            </div>
          </motion.div>
        )}
      </div>
    </>
  );
}
