import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAudio } from '../../hooks/useAudio';
import { ClassifyGame } from '../../components/game/ClassifyGame';
import { ScoreBoard } from '../../components/game/ScoreBoard';
import { GameInstructions } from '../../components/game/GameInstructions';
import { GameControlBar } from '../../components/game/GameControlBar';
import { classifyInstructions } from '../../lib/gameplayInstructions';
import type { TrainingDetails } from '../../types';

export function Classify() {
  const { startGame, endGame, status } = useGameStore();
  const { soundEnabled } = useSettingsStore();
  const { playEffect } = useAudio();

  const [showResult, setShowResult] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [gameResult, setGameResult] = useState<{
    correctCount: number;
    totalCount: number;
    ruleSwitches: number;
    avgReactionTime: number;
  } | null>(null);

  const isPlaying = status === 'playing';

  const handleStart = useCallback(() => {
    startGame('classify');
    setShowResult(false);
    setFinalScore(0);
    setGameResult(null);
  }, [startGame]);

  const handleComplete = useCallback((result: {
    correctCount: number;
    totalCount: number;
    ruleSwitches: number;
    avgReactionTime: number;
  }) => {
    setGameResult(result);

    // 计算分数
    const accuracyScore = (result.correctCount / result.totalCount) * 600;
    const speedBonus = Math.max(0, 200 - result.avgReactionTime / 10);
    const switchBonus = result.ruleSwitches * 50;

    const score = Math.round(accuracyScore + speedBonus + switchBonus);
    const accuracy = Math.round((result.correctCount / result.totalCount) * 100);

    const details: TrainingDetails = {
      ruleType: 'mixed',
      questionCount: result.totalCount,
      correctCount: result.correctCount,
      avgReactionTime: result.avgReactionTime,
      ruleSwitches: result.ruleSwitches,
    };

    endGame({
      score,
      accuracy,
      details,
    });

    setFinalScore(score);
    setShowResult(true);

    if (soundEnabled) {
      playEffect(accuracy >= 80 ? 'complete' : 'tick');
    }
  }, [endGame, soundEnabled, playEffect]);

  return (
    <>
      <GameControlBar title="分类逻辑" showTimer={isPlaying} elapsedTime={0} />
      <div className="max-w-2xl mx-auto px-6 pt-4 pb-32 flex flex-col" style={{ minHeight: 'calc(100vh - 140px)' }}>
        {/* Header */}
        {!isPlaying && !showResult && (
          <div className="mb-3 self-start">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground mb-1 font-headline">
              分类逻辑
            </h1>
            <p className="text-muted-foreground text-sm">
              根据当前规则对物品进行分类。规则会随机切换，保持专注！
            </p>
          </div>
        )}

        {/* 玩法说明 */}
        {!isPlaying && !showResult && (
          <GameInstructions
            title={classifyInstructions.title}
            description={classifyInstructions.objective}
            steps={classifyInstructions.howToPlay}
            className="mb-3"
          />
        )}

      {/* 游戏区域 */}
      <div className="flex-1 flex flex-col justify-start py-2 mb-4">
        <ClassifyGame
          isActive={isPlaying}
          onComplete={handleComplete}
        />
      </div>

      {/* 控制按钮 */}
      <div className="flex justify-center gap-4">
        {!isPlaying && !showResult && (
          <motion.button
            onClick={handleStart}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-lg"
          >
            开始训练
          </motion.button>
        )}

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

      {/* 结果展示 */}
      {showResult && gameResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 p-6 bg-surface-container-low rounded-2xl border border-border"
        >
          <h3 className="text-lg font-semibold mb-4 text-center font-headline">训练完成！</h3>
          <ScoreBoard
            score={finalScore}
            accuracy={Math.round((gameResult.correctCount / gameResult.totalCount) * 100)}
          />

          {/* 详细统计 */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-accent/50 rounded-xl">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">正确数</div>
              <div className="text-2xl font-bold font-headline text-primary">
                {gameResult.correctCount} / {gameResult.totalCount}
              </div>
            </div>
            <div className="text-center p-3 bg-accent/50 rounded-xl">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">规则切换</div>
              <div className="text-2xl font-bold font-headline text-primary">{gameResult.ruleSwitches} 次</div>
            </div>
          </div>

          {/* 平均反应时间 */}
          <div className="mt-4 text-center p-3 bg-accent/50 rounded-xl">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">平均反应时间</div>
            <div className="text-2xl font-bold font-headline text-primary">
              {gameResult.avgReactionTime}ms
            </div>
          </div>

          {/* 评价 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {finalScore >= 800
                ? '🎉 完美！你的认知灵活性非常出色！'
                : finalScore >= 600
                ? '👏 很棒！继续保持！'
                : finalScore >= 400
                ? '💪 不错，继续练习！'
                : '📚 多练习，你会进步的！'}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  </>
);
}
