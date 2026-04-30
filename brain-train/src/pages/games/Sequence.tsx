import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAudio } from '../../hooks/useAudio';
import { SequenceGame } from '../../components/game/SequenceGame';
import { ScoreBoard } from '../../components/game/ScoreBoard';
import { GameInstructions } from '../../components/game/GameInstructions';
import { GameControlBar } from '../../components/game/GameControlBar';
import { sequenceInstructions } from '../../lib/gameplayInstructions';
import type { TrainingDetails } from '../../types';

// 难度配置
const DIFFICULTY_CONFIG: Record<'easy' | 'medium' | 'hard', { sequenceLength: number }> = {
  easy: { sequenceLength: 5 },
  medium: { sequenceLength: 7 },
  hard: { sequenceLength: 10 },
};

export function Sequence() {
  const { startGame, endGame, status } = useGameStore();
  const { soundEnabled } = useSettingsStore();
  const { playEffect } = useAudio();

  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [showResult, setShowResult] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [gameResult, setGameResult] = useState<{
    sequence: string[];
    userSequence: string[];
    positionAccuracy: number;
    itemAccuracy: number;
  } | null>(null);

  const isPlaying = status === 'playing';
  const config = DIFFICULTY_CONFIG[difficulty];

  const handleStart = useCallback(() => {
    startGame('sequence');
    setShowResult(false);
    setFinalScore(0);
    setGameResult(null);
  }, [startGame]);

  const handleComplete = useCallback((result: {
    sequence: string[];
    userSequence: string[];
    positionAccuracy: number;
    itemAccuracy: number;
  }) => {
    setGameResult(result);

    // 计算分数
    const positionWeight = 0.6; // 位置准确率权重
    const itemWeight = 0.4;     // 物品准确率权重

    const baseScore = 500;
    const accuracyScore = (result.positionAccuracy * positionWeight + result.itemAccuracy * itemWeight) * 5;
    const score = Math.round(baseScore + accuracyScore);

    const accuracy = Math.round((result.positionAccuracy + result.itemAccuracy) / 2);

    const details: TrainingDetails = {
      sequenceLength: result.sequence.length,
      items: result.sequence,
      userSequence: result.userSequence,
      positionAccuracy: result.positionAccuracy,
      itemAccuracy: result.itemAccuracy,
    };

    endGame({
      score,
      accuracy,
      details,
    });

    setFinalScore(score);
    setShowResult(true);

    if (soundEnabled) {
      playEffect(result.positionAccuracy > 80 ? 'complete' : 'tick');
    }
  }, [endGame, soundEnabled, playEffect]);

  // 难度选择器
  const DifficultySelector = () => (
    <div className="flex justify-center gap-2 mb-6">
      {(['easy', 'medium', 'hard'] as const).map((d) => (
        <button
          key={d}
          onClick={() => setDifficulty(d)}
          disabled={isPlaying}
          className={`
            px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${difficulty === d
              ? 'bg-primary text-primary-foreground'
              : 'bg-accent text-accent-foreground hover:bg-accent/80'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {d === 'easy' && '简单 (5个)'}
          {d === 'medium' && '中等 (7个)'}
          {d === 'hard' && '困难 (10个)'}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <GameControlBar title="序列记忆" showTimer={isPlaying} elapsedTime={0} />
      <div className="max-w-2xl mx-auto px-6 pt-4 pb-32 flex flex-col" style={{ minHeight: 'calc(100vh - 140px)' }}>
        {/* Header */}
        {!isPlaying && !showResult && (
          <div className="mb-3 self-start">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground mb-1 font-headline">
              序列记忆
            </h1>
            <p className="text-muted-foreground text-sm">
              记住物品出现的顺序，然后按照相同顺序点击它们。
            </p>
          </div>
        )}

        {/* 玩法说明 */}
        {!isPlaying && !showResult && (
          <GameInstructions
            title={sequenceInstructions.title}
            description={sequenceInstructions.objective}
            steps={sequenceInstructions.howToPlay}
            className="mb-3"
          />
        )}

      {/* 难度选择 */}
      {!isPlaying && !showResult && <DifficultySelector />}

      {/* 游戏区域 */}
      <div className="flex-1 flex flex-col justify-start py-2 mb-4">
        <SequenceGame
          sequenceLength={config.sequenceLength}
          onComplete={handleComplete}
          isActive={isPlaying}
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
            accuracy={Math.round((gameResult.positionAccuracy + gameResult.itemAccuracy) / 2)}
          />

          {/* 详细统计 */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-accent/50 rounded-xl">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">位置准确率</div>
              <div className="text-2xl font-bold font-headline text-primary">{gameResult.positionAccuracy}%</div>
            </div>
            <div className="text-center p-3 bg-accent/50 rounded-xl">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">物品准确率</div>
              <div className="text-2xl font-bold font-headline text-primary">{gameResult.itemAccuracy}%</div>
            </div>
          </div>

          {/* 序列对比 */}
          <div className="mt-6 space-y-4">
            {/* 正确答案 */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">正确顺序</p>
              <div className="flex justify-center gap-2 flex-wrap">
                {gameResult.sequence.map((item, index) => (
                  <div
                    key={`correct-${index}`}
                    className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-xl"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* 用户答案 */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">你的答案</p>
              <div className="flex justify-center gap-2 flex-wrap">
                {gameResult.userSequence.map((item, index) => {
                  const isCorrect = item === gameResult.sequence[index];
                  return (
                    <div
                      key={`user-${index}`}
                      className={`
                        w-10 h-10 rounded-lg flex items-center justify-center text-xl
                        ${isCorrect ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'}
                      `}
                    >
                      {item}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 评价 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {gameResult.positionAccuracy === 100
                ? '🎉 完美！你的记忆力令人惊叹！'
                : gameResult.positionAccuracy >= 80
                ? '👏 很棒！继续保持！'
                : gameResult.positionAccuracy >= 60
                ? '💪 不错，还有提升空间！'
                : '📚 继续练习，你会进步的！'}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  </>
);
}
