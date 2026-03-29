import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAudio } from '../../hooks/useAudio';
import { MirrorGame, type TargetShape } from '../../components/game/MirrorGame';
import { ScoreBoard } from '../../components/game/ScoreBoard';
import { GameInstructions } from '../../components/game/GameInstructions';
import { mirrorInstructions } from '../../lib/gameplayInstructions';
import type { TrainingDetails } from '../../types';

// 形状配置
const SHAPES: TargetShape[] = ['line', 'circle', 'square', 'triangle'];

export function Mirror() {
  const { startGame, endGame, status } = useGameStore();
  const { soundEnabled } = useSettingsStore();
  const { playEffect } = useAudio();

  const [targetShape, setTargetShape] = useState<TargetShape>('line');
  const [showResult, setShowResult] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [gameResult, setGameResult] = useState<{
    symmetryScore: number;
    completeness: number;
    leftPath: { points: { x: number; y: number; timestamp: number }[] };
    rightPath: { points: { x: number; y: number; timestamp: number }[] };
  } | null>(null);

  const isPlaying = status === 'playing';

  // 随机选择形状
  const getRandomShape = useCallback(() => {
    return SHAPES[Math.floor(Math.random() * SHAPES.length)];
  }, []);

  const handleStart = useCallback(() => {
    const shape = getRandomShape();
    setTargetShape(shape);
    startGame('mirror');
    setShowResult(false);
    setFinalScore(0);
    setGameResult(null);
  }, [getRandomShape, startGame]);

  const handleComplete = useCallback((result: {
    symmetryScore: number;
    completeness: number;
    leftPath: { points: { x: number; y: number; timestamp: number }[] };
    rightPath: { points: { x: number; y: number; timestamp: number }[] };
  }) => {
    setGameResult(result);

    // 计算分数
    const symmetryWeight = 0.6;
    const completenessWeight = 0.4;

    const score = Math.round(
      result.symmetryScore * symmetryWeight +
      result.completeness * completenessWeight
    );

    const accuracy = Math.round((result.symmetryScore + result.completeness) / 2);

    const details: TrainingDetails = {
      targetShape,
      symmetryScore: result.symmetryScore,
      completeness: result.completeness,
      pathLength: result.leftPath.points.length,
      leftPath: result.leftPath,
      rightPath: result.rightPath,
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
  }, [targetShape, endGame, soundEnabled, playEffect]);

  return (
    <div className="max-w-2xl mx-auto px-6 pt-4 pb-24">
      {/* Header */}
      <div className="mb-6 self-start">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-2 font-headline">
          Mirror Coordination
        </h1>
        <p className="text-muted-foreground text-sm font-medium tracking-wide">
          在左侧画布上沿虚线绘制目标形状，右侧会实时显示镜像效果。训练双侧肢体协调。
        </p>
      </div>

      {/* 玩法说明 */}
      <GameInstructions
        title={mirrorInstructions.title}
        description={mirrorInstructions.objective}
        steps={mirrorInstructions.howToPlay}
        className="mb-4"
      />

      {/* 游戏区域 */}
      <div className="mb-8">
        <MirrorGame
          targetShape={targetShape}
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
            accuracy={Math.round((gameResult.symmetryScore + gameResult.completeness) / 2)}
          />

          {/* 详细统计 */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-accent/50 rounded-xl">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">对称性分数</div>
              <div className="text-2xl font-bold font-headline text-primary">{gameResult.symmetryScore}%</div>
            </div>
            <div className="text-center p-3 bg-accent/50 rounded-xl">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">完整性分数</div>
              <div className="text-2xl font-bold font-headline text-primary">{gameResult.completeness}%</div>
            </div>
          </div>

          {/* 路径信息 */}
          <div className="mt-6 text-center">
            <div className="text-xs text-muted-foreground">
              绘制点数: <span className="font-medium text-foreground">{gameResult.leftPath.points.length}</span>
            </div>
          </div>

          {/* 评价 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {finalScore >= 90
                ? '🎉 完美！你的双侧协调非常出色！'
                : finalScore >= 75
                ? '👏 很棒！协调能力良好！'
                : finalScore >= 60
                ? '💪 不错，继续练习！'
                : '📚 多练习，你会进步的！'}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
