import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAudio } from '../../hooks/useAudio';
import { BottleGame } from '../../components/game/BottleGame';
import { ScoreBoard } from '../../components/game/ScoreBoard';
import { GameControlBar } from '../../components/game/GameControlBar';
import { GameStartScreen } from '../../components/game/GameStartScreen';
import { DifficultySelector } from '../../components/game/DifficultySelector';
import { useStartCountdown } from '../../hooks/useStartCountdown';
import type { TrainingDetails } from '../../types';

type Difficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTY_CONFIG = {
  easy: { count: 4, label: '简单' },
  medium: { count: 6, label: '中等' },
  hard: { count: 9, label: '困难' },
} as const;

// 计分配置：按难度调整。整体偏宽松——封顶更高、步数惩罚更轻、时限基准更宽，
// 避免随机初始排列带来的运气成分让分数过于严苛。
const SCORING_CONFIG: Record<Difficulty, {
  baselineTime: number;   // 基准时间（秒），低于此不扣时间分
  stepPenalty: number;    // 每多 1 步（相对最优）扣多少分
  timeDecay: number;      // 超过基准后每秒扣多少分
  maxScore: number;       // 封顶分数
}> = {
  easy:   { baselineTime: 30,  stepPenalty: 8,  timeDecay: 0.5, maxScore: 150 },
  medium: { baselineTime: 60,  stepPenalty: 6,  timeDecay: 0.3, maxScore: 200 },
  hard:   { baselineTime: 120, stepPenalty: 4,  timeDecay: 0.2, maxScore: 300 },
};

export function Bottle() {
  const { startGame, endGame, resetGame, status } = useGameStore();
  const { soundEnabled } = useSettingsStore();
  const { playEffect } = useAudio();

  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [gameStartTime, setGameStartTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  // 完成瞬间冻结的最终用时。endGame 是异步的，期间 status 仍是 playing，
  // 若不冻结，计时器会继续把 elapsedTime 往上推，导致结果页用时显示还在涨。
  const [finalTime, setFinalTime] = useState(0);
  const [totalSwaps, setTotalSwaps] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [lastOptimalSwaps, setLastOptimalSwaps] = useState(0);
  // 开局 3 秒倒计时缓冲：结束后才真正 startGame（不计入游戏用时）
  const { overlay: countdownOverlay, trigger: triggerCountdown } = useStartCountdown();

  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const isIdle = status === 'idle';

  // 计时器：仅 playing 阶段、且未完成时运行。
  // endGame 是异步的，status 在其 resolve 前仍为 playing；用 showResult 作为
  // 同步的「已完成」标志让计时器立即停，避免用时持续上涨。
  useEffect(() => {
    if (!isPlaying || gameStartTime === 0 || showResult) return;
    const interval = setInterval(() => {
      setElapsedTime((Date.now() - gameStartTime) / 1000);
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, gameStartTime, showResult]);

  const handleStart = useCallback(() => {
    triggerCountdown(() => {
      startGame('bottle');
      setGameStartTime(Date.now());
      setElapsedTime(0);
      setFinalTime(0);
      setTotalSwaps(0);
      setShowResult(false);
      setFinalScore(0);
    });
  }, [startGame, triggerCountdown]);

  // 再玩一次：回到开始/选难度页，而非直接开新一局（让玩家能改难度）
  const handlePlayAgain = useCallback(() => {
    resetGame();
    setShowResult(false);
    setFinalScore(0);
    setFinalTime(0);
    setElapsedTime(0);
    setTotalSwaps(0);
  }, [resetGame]);

  const handleSwap = useCallback(() => {
    setTotalSwaps(prev => prev + 1);
    if (soundEnabled) {
      playEffect('tick');
    }
  }, [soundEnabled, playEffect]);

  const handleComplete = useCallback((
    swaps: number,
    optimalSwaps: number,
    targetSeq: string[],
    playerSeq: string[],
  ) => {
    // 同步冻结最终用时——避免异步 endGame 期间计时器继续走导致用时虚涨
    const totalTime = (Date.now() - gameStartTime) / 1000;
    setFinalTime(totalTime);

    const config = SCORING_CONFIG[difficulty];
    const bottleCount = DIFFICULTY_CONFIG[difficulty].count;

    // 计分：步数 70% + 时间 30%，整体放宽后封顶 maxScore
    const extraSwaps = Math.max(0, swaps - optimalSwaps);
    const stepScore = Math.max(0, 100 - extraSwaps * config.stepPenalty);
    const timeScore = Math.max(0, 100 - Math.max(0, totalTime - config.baselineTime) * config.timeDecay);
    const score = Math.min(config.maxScore, Math.round((stepScore * 0.7 + timeScore * 0.3) * config.maxScore / 100));

    // 暗瓶的初始排列是随机的，玩家用多少步受运气影响，准确率（optimal/actual）不具参考意义，故不统计
    const details: TrainingDetails = {
      difficulty,
      bottleCount,
      targetSequence: targetSeq,
      playerSequence: playerSeq,
      totalSwaps: swaps,
      optimalSwaps,
      completionTime: totalTime,
    };

    // 暗瓶的初始排列是随机的，玩家用多少步受运气影响，准确率（optimal/actual）不具参考意义，故不显示。
    // 但完成态意味着位置全匹配，写入 100 避免污染 Stats 的 avgAccuracy 聚合统计。
    void endGame({ score, accuracy: 100, details });
    setFinalScore(score);
    setLastOptimalSwaps(optimalSwaps);
    setShowResult(true);

    if (soundEnabled) {
      playEffect('complete');
    }
  }, [gameStartTime, difficulty, endGame, soundEnabled, playEffect]);

  const bottleCount = DIFFICULTY_CONFIG[difficulty].count;

  return (
    <>
      <GameControlBar
        title="暗瓶排列"
        showTimer={isPlaying || showResult}
        elapsedTime={Math.floor(showResult ? finalTime : elapsedTime)}
      />

      <div className="max-w-2xl mx-auto px-6 pt-4 pb-32 flex flex-col" style={{ minHeight: 'calc(100vh - 140px)' }}>
        {/* 开始页面（含难度选择） */}
        {isIdle && !showResult && (
          <div className="flex flex-col items-center gap-6 pt-8">
            {/* 难度选择放在最前，从结果页「选难度」回来时第一眼可见 */}
            <div className="w-full max-w-xs">
              <p className="text-center text-sm font-semibold mb-2 text-foreground">选择难度</p>
              <DifficultySelector
                value={difficulty}
                onChange={(d) => setDifficulty(d)}
              />
              <p className="text-center text-xs text-muted-foreground mt-2">
                {bottleCount} 个瓶子
              </p>
            </div>
            <GameStartScreen
              mode="bottle"
              title="暗瓶排列"
              description="交换上排瓶子，推理出隐藏的下排排列"
              onStart={handleStart}
            />
          </div>
        )}

        {/* 游戏进行中：完成后(showResult)不再渲染棋盘，本局即定局 */}
        {!showResult && (isPlaying || isPaused) && (
          <div className="flex-1 flex flex-col items-center justify-center gap-8 py-8">
            <BottleGame
              bottleCount={bottleCount}
              isActive={isPlaying && !showResult}
              startTime={gameStartTime}
              onSwap={handleSwap}
              onComplete={handleComplete}
            />
            {/* 底部状态 */}
            <div className="flex justify-center gap-12">
              <div className="flex flex-col items-center">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">步数</span>
                <span className="text-foreground text-2xl font-bold font-headline">{totalSwaps}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">用时</span>
                <span className="text-foreground text-2xl font-bold font-headline">{Math.floor(showResult ? finalTime : elapsedTime)}s</span>
              </div>
            </div>
          </div>
        )}

        {/* 结果页面 */}
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-6 pt-8"
          >
            <div className="p-6 bg-surface-container-low rounded-2xl border border-border w-full">
              <h3 className="text-lg font-semibold mb-4 text-center font-headline">训练完成！</h3>
              <ScoreBoard score={finalScore} />
              <div className="mt-4 text-center text-sm text-muted-foreground space-y-1">
                <p>步数: {totalSwaps}（最优: {lastOptimalSwaps}）</p>
                <p>用时: {finalTime.toFixed(1)}秒</p>
                <p>难度: {DIFFICULTY_CONFIG[difficulty].label}（{bottleCount}个瓶子）</p>
              </div>
            </div>
            <div className="w-full max-w-xs">
              <p className="text-center text-sm font-semibold mb-2 text-foreground">再玩一次（可改难度）</p>
              <DifficultySelector
                value={difficulty}
                onChange={(d) => setDifficulty(d)}
              />
              <p className="text-center text-xs text-muted-foreground mt-2 mb-4">
                {bottleCount} 个瓶子
              </p>
            </div>
            <div className="flex gap-3">
              <motion.button
                onClick={handleStart}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-lg"
              >
                再玩一次
              </motion.button>
              <motion.button
                onClick={handlePlayAgain}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-3 bg-surface-container-high text-foreground rounded-xl font-semibold hover:bg-surface-container-highest transition-all shadow-lg"
              >
                返回
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>

      {/* 开局倒计时遮罩 */}
      {countdownOverlay}
    </>
  );
}
