import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAudio } from '../../hooks/useAudio';
import { StoryGame } from '../../components/game/StoryGame';
import { ScoreBoard } from '../../components/game/ScoreBoard';
import { GameInstructions } from '../../components/game/GameInstructions';
import { storyInstructions } from '../../lib/gameplayInstructions';
import type { TrainingDetails } from '../../types';

export function Story() {
  const { startGame, endGame, status } = useGameStore();
  const { soundEnabled } = useSettingsStore();
  const { playEffect } = useAudio();

  const [showResult, setShowResult] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [gameResult, setGameResult] = useState<{
    sceneName: string;
    recalledCount: number;
    totalCount: number;
    recallAccuracy: number;
    storyCompleteness: number;
  } | null>(null);

  const isPlaying = status === 'playing';

  const handleStart = useCallback(() => {
    startGame('story');
    setShowResult(false);
    setFinalScore(0);
    setGameResult(null);
  }, [startGame]);

  const handleComplete = useCallback((result: {
    scene: { name: string; items: { name: string }[] };
    recalledItems: string[];
    storyCompleteness: number;
    recallAccuracy: number;
  }) => {
    setGameResult({
      sceneName: result.scene.name,
      recalledCount: result.recalledItems.length,
      totalCount: result.scene.items.length,
      recallAccuracy: result.recallAccuracy,
      storyCompleteness: result.storyCompleteness,
    });

    // 计算分数
    const baseScore = 300;
    const accuracyBonus = result.recallAccuracy * 4;
    const completenessBonus = result.storyCompleteness * 3;

    const score = Math.round(baseScore + accuracyBonus + completenessBonus);
    const accuracy = result.recallAccuracy;

    const details: TrainingDetails = {
      items: result.scene.items.map(item => item.name),
      userStory: '',
      storyCompleteness: result.storyCompleteness,
      recallAccuracy: result.recallAccuracy,
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
    <div className="max-w-2xl mx-auto px-6 pt-4 pb-24">
      {/* Header */}
      <div className="mb-6 self-start">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-2 font-headline">
          Scenario Association
        </h1>
        <p className="text-muted-foreground text-sm font-medium tracking-wide">
          记住场景中的物品，然后尝试回忆并编一个包含这些物品的故事。训练联想记忆。
        </p>
      </div>

      {/* 玩法说明 */}
      <GameInstructions
        title={storyInstructions.title}
        description={storyInstructions.objective}
        steps={storyInstructions.howToPlay}
        className="mb-4"
      />

      {/* 游戏区域 */}
      <div className="mb-8">
        <StoryGame
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
          className="mt-8 p-6 bg-surface-container-low dark:bg-[#131b2e] rounded-2xl border border-border"
        >
          <h3 className="text-lg font-semibold mb-4 text-center font-headline">训练完成！</h3>
          <ScoreBoard
            score={finalScore}
            accuracy={gameResult.recallAccuracy}
          />

          {/* 详细统计 */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-accent/50 rounded-xl">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">场景</div>
              <div className="text-xl font-bold font-headline text-primary">{gameResult.sceneName}</div>
            </div>
            <div className="text-center p-3 bg-accent/50 rounded-xl">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">回忆物品</div>
              <div className="text-2xl font-bold font-headline text-primary">
                {gameResult.recalledCount} / {gameResult.totalCount}
              </div>
            </div>
          </div>

          {/* 故事完整度 */}
          <div className="mt-4 text-center p-3 bg-accent/50 rounded-xl">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">故事完整度</div>
            <div className="text-2xl font-bold font-headline text-primary">{gameResult.storyCompleteness}%</div>
          </div>

          {/* 评价 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {finalScore >= 800
                ? '🎉 完美！你的联想记忆力令人惊叹！'
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
  );
}
