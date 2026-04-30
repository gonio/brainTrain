import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAudio } from '../../hooks/useAudio';
import { AuditoryGame } from '../../components/game/AuditoryGame';
import { ScoreBoard } from '../../components/game/ScoreBoard';
import { GameInstructions } from '../../components/game/GameInstructions';
import { GameControlBar } from '../../components/game/GameControlBar';
import { auditoryInstructions } from '../../lib/gameplayInstructions';
import type { TrainingDetails } from '../../types';

export function Auditory() {
  const { startGame, endGame, status } = useGameStore();
  const { soundEnabled } = useSettingsStore();
  const { playEffect } = useAudio();

  const [withNoise, setWithNoise] = useState(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [showResult, setShowResult] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [gameResult, setGameResult] = useState<{
    sequence: number[];
    userSequence: number[];
    correctCount: number;
  } | null>(null);

  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';

  const handleStart = useCallback(() => {
    if (!soundEnabled) {
      alert('请先开启声音以进行听觉训练');
      return;
    }
    startGame('auditory');
    setShowResult(false);
    setFinalScore(0);
    setGameResult(null);
  }, [startGame, soundEnabled]);

  const handleComplete = useCallback((result: {
    sequence: number[];
    userSequence: number[];
    correctCount: number;
  }) => {
    setGameResult(result);

    // 计算分数
    const noiseBonus = withNoise ? 1.2 : 1;

    const baseScore = 300;
    const accuracyScore = (result.correctCount / result.sequence.length) * 700;
    const score = Math.round((baseScore + accuracyScore) * noiseBonus);

    const accuracy = Math.round((result.correctCount / result.sequence.length) * 100);

    const details: TrainingDetails = {
      digitCount: result.sequence.length,
      withNoise,
      digits: result.sequence,
      userDigits: result.userSequence,
      correctCount: result.correctCount,
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
  }, [withNoise, endGame, soundEnabled, playEffect]);

  // 难度选择器
  const DifficultySelector = () => (
    <div className="space-y-4 mb-6">
      <div className="flex justify-center gap-2">
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
            {d === 'easy' && '简单 (3位)'}
            {d === 'medium' && '中等 (5位)'}
            {d === 'hard' && '困难 (7位)'}
          </button>
        ))}
      </div>

      {/* 干扰选项 */}
      <div className="flex justify-center">
        <label className={`
          flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all
          ${withNoise ? 'bg-yellow-500/20 text-yellow-600' : 'bg-accent'}
          ${isPlaying ? 'opacity-50 cursor-not-allowed' : ''}
        `}>
          <input
            type="checkbox"
            checked={withNoise}
            onChange={(e) => setWithNoise(e.target.checked)}
            disabled={isPlaying}
            className="sr-only"
          />
          <span className="text-sm font-medium">
            {withNoise ? '🔊 开启干扰 (+20% 分数)' : '添加背景噪音干扰'}
          </span>
        </label>
      </div>
    </div>
  );

  return (
    <>
      <GameControlBar title="听觉注意" showTimer={isPlaying} elapsedTime={0} />
      <div className="max-w-2xl mx-auto px-6 pt-4 pb-32 flex flex-col" style={{ minHeight: 'calc(100vh - 140px)' }}>
        {/* Header */}
        {!isPlaying && !showResult && (
          <div className="mb-3 self-start">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground mb-1 font-headline">
              听觉注意
            </h1>
            <p className="text-muted-foreground text-sm">
              仔细听播放的数字序列，然后在干扰中准确地重复它们。
            </p>
          </div>
        )}

        {/* 玩法说明 */}
        {!isPlaying && !showResult && (
          <GameInstructions
            title={auditoryInstructions.title}
            description={auditoryInstructions.objective}
            steps={auditoryInstructions.howToPlay}
            className="mb-3"
          />
        )}

      {/* 声音提示 */}
      {!soundEnabled && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-center">
          <p className="text-sm text-yellow-600">
            ⚠️ 请在设置中开启声音以进行此训练
          </p>
        </div>
      )}

      {/* 难度选择 */}
      {!isPlaying && !showResult && <DifficultySelector />}

      {/* 游戏区域 */}
      <div className="flex-1 flex flex-col justify-start py-2 mb-4">
        <AuditoryGame
          difficulty={difficulty}
          withNoise={withNoise}
          isActive={isPlaying}
          isPaused={isPaused}
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
            disabled={!soundEnabled}
            className={`
              px-8 py-3 rounded-xl font-semibold transition-all shadow-lg
              ${soundEnabled
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
              }
            `}
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
            accuracy={Math.round((gameResult.correctCount / gameResult.sequence.length) * 100)}
          />

          {/* 详细统计 */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-accent/50 rounded-xl">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">正确数字</div>
              <div className="text-2xl font-bold font-headline text-primary">
                {gameResult.correctCount} / {gameResult.sequence.length}
              </div>
            </div>
            <div className="text-center p-3 bg-accent/50 rounded-xl">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">准确率</div>
              <div className="text-2xl font-bold font-headline text-primary">
                {Math.round((gameResult.correctCount / gameResult.sequence.length) * 100)}%
              </div>
            </div>
          </div>

          {/* 序列对比 */}
          <div className="mt-6 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-2">正确答案</p>
              <div className="flex justify-center gap-2">
                {gameResult.sequence.map((num, index) => (
                  <div
                    key={`correct-${index}`}
                    className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-lg font-bold"
                  >
                    {num}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">你的答案</p>
              <div className="flex justify-center gap-2">
                {gameResult.userSequence.map((num, index) => {
                  const isCorrect = num === gameResult.sequence[index];
                  return (
                    <div
                      key={`user-${index}`}
                      className={`
                        w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold
                        ${isCorrect ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'}
                      `}
                    >
                      {num}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 评价 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {gameResult.correctCount === gameResult.sequence.length
                ? '🎉 完美！你的听觉注意力很棒！'
                : gameResult.correctCount >= gameResult.sequence.length * 0.8
                ? '👏 很棒！继续保持！'
                : gameResult.correctCount >= gameResult.sequence.length * 0.6
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
