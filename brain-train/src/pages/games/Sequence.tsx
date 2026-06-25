import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAudio } from '../../hooks/useAudio';
import { SequenceGame } from '../../components/game/SequenceGame';
import { ScoreBoard } from '../../components/game/ScoreBoard';
import { GameControlBar } from '../../components/game/GameControlBar';
import { GameStartScreen } from '../../components/game/GameStartScreen';
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
  const [gameStartTime, setGameStartTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [gameResult, setGameResult] = useState<{
    sequence: string[];
    userSequence: string[];
    positionAccuracy: number;
    itemAccuracy: number;
  } | null>(null);

  const isPlaying = status === 'playing';
  const isIdle = status === 'idle';
  const config = DIFFICULTY_CONFIG[difficulty];

  // 计时器：playing 时每 100ms 更新已用时间
  useEffect(() => {
    if (!isPlaying || gameStartTime === 0) return;
    const interval = setInterval(() => {
      setElapsedTime((Date.now() - gameStartTime) / 1000);
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, gameStartTime]);

  const handleStart = useCallback(() => {
    startGame('sequence');
    setGameStartTime(Date.now());
    setElapsedTime(0);
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

    // 0-100 分制：位置准确率 60% + 物品准确率 40%
    const accuracyScore = result.positionAccuracy * 0.6 + result.itemAccuracy * 0.4;
    const score = Math.min(100, Math.round(accuracyScore));

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
      <GameControlBar title="序列记忆" showTimer={isPlaying} elapsedTime={Math.floor(elapsedTime)} />
      <div className="max-w-2xl mx-auto px-6 pt-4 pb-32 flex flex-col" style={{ minHeight: 'calc(100vh - 140px)' }}>
        {/* 游戏开始页面 */}
        {isIdle && !showResult && (
          <GameStartScreen
            mode="sequence"
            title="序列记忆"
            description="记住物品出现的顺序，然后按照相同顺序点击它们"
            onStart={handleStart}
          />
        )}

        {/* 难度选择 - 仅在非游戏开始页面时显示（已集成到GameStartScreen下方） */}
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
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">位置准确率</div>
              <div className="text-2xl font-bold font-headline text-primary">{gameResult.positionAccuracy}%</div>
            </div>
            <div className="text-center p-3 bg-accent/50 rounded-xl">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">物品准确率</div>
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
