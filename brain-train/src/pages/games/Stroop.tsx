import { useState, useCallback, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAudio } from '../../hooks/useAudio';
import { StroopGame } from '../../components/game/StroopGame';
import { ScoreBoard } from '../../components/game/ScoreBoard';
import { GameInstructions } from '../../components/game/GameInstructions';
import { GameControlBar } from '../../components/game/GameControlBar';
import { stroopInstructions } from '../../lib/gameplayInstructions';
import type { TrainingDetails, StroopQuestion } from '../../types';

// 游戏配置
const QUESTION_COUNT = 15; // 每轮题目数

export function Stroop() {
  const { startGame, endGame, status } = useGameStore();
  const { soundEnabled } = useSettingsStore();
  const { playEffect } = useAudio();

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [questions, setQuestions] = useState<StroopQuestion[]>([]);
  const [gameStartTime, setGameStartTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  const isPlaying = status === 'playing';

  // 计时器
  useEffect(() => {
    if (!isPlaying || gameStartTime === 0) return;

    const interval = setInterval(() => {
      setElapsedTime((Date.now() - gameStartTime) / 1000);
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, gameStartTime]);

  // 计算统计数据
  const stats = {
    correctCount: questions.filter(q => q.isCorrect).length,
    avgReactionTime: questions.length > 0
      ? questions.reduce((sum, q) => sum + q.reactionTime, 0) / questions.length
      : 0,
    accuracy: questions.length > 0
      ? Math.round((questions.filter(q => q.isCorrect).length / questions.length) * 100)
      : 0,
  };

  const handleStart = useCallback(() => {
    startGame('stroop');
    setGameStartTime(Date.now());
    setCurrentQuestion(0);
    setQuestions([]);
    setElapsedTime(0);
    setShowResult(false);
    setFinalScore(0);
  }, [startGame]);

  const handleAnswer = useCallback((question: StroopQuestion) => {
    setQuestions(prev => [...prev, question]);

    if (soundEnabled) {
      playEffect(question.isCorrect ? 'tick' : 'wrong');
    }

    // 检查是否完成所有题目
    if (currentQuestion + 1 >= QUESTION_COUNT) {
      // 游戏结束
      const correctCount = [...questions, question].filter(q => q.isCorrect).length;
      const avgReactionTime = [...questions, question].reduce((sum, q) => sum + q.reactionTime, 0) / QUESTION_COUNT;

      // 计算分数：基础分 + 准确率奖励 - 平均反应时间惩罚
      const baseScore = 500;
      const accuracyBonus = (correctCount / QUESTION_COUNT) * 500;
      const speedBonus = Math.max(0, 300 - avgReactionTime);
      const score = Math.round(baseScore + accuracyBonus + speedBonus);

      const accuracy = Math.round((correctCount / QUESTION_COUNT) * 100);

      const details: TrainingDetails = {
        questionCount: QUESTION_COUNT,
        correctCount,
        avgReactionTime,
        questions: [...questions, question],
      };

      endGame({
        score,
        accuracy,
        details,
      });

      setFinalScore(score);
      setShowResult(true);

      if (soundEnabled) {
        playEffect('complete');
      }
    } else {
      // 下一题
      setCurrentQuestion(prev => prev + 1);
    }
  }, [currentQuestion, questions, endGame, soundEnabled, playEffect]);

  return (
    <>
      <GameControlBar title="字色干扰" showTimer={isPlaying} elapsedTime={Math.floor(elapsedTime)} />
      <div className="max-w-2xl mx-auto px-6 pt-4 pb-32 flex flex-col" style={{ minHeight: 'calc(100vh - 140px)' }}>
        {/* Header */}
        {!isPlaying && !showResult && (
          <div className="mb-3 self-start">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground mb-1 font-headline">
              字色干扰
            </h1>
            <p className="text-muted-foreground text-sm">
              忽略文字含义，快速识别文字的颜色。
            </p>
          </div>
        )}

        {/* 玩法说明 */}
        {!isPlaying && !showResult && (
          <GameInstructions
            title={stroopInstructions.title}
            description={stroopInstructions.objective}
            steps={stroopInstructions.howToPlay}
            className="mb-3"
          />
        )}

      {/* 游戏统计 */}
      {isPlaying && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-accent rounded-xl">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">正确</div>
            <div className="text-xl font-bold font-headline">{stats.correctCount}</div>
          </div>
          <div className="text-center p-3 bg-accent rounded-xl">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">准确率</div>
            <div className="text-xl font-bold font-headline">{stats.accuracy}%</div>
          </div>
          <div className="text-center p-3 bg-accent rounded-xl">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">平均反应</div>
            <div className="text-xl font-bold font-headline">{Math.round(stats.avgReactionTime)}ms</div>
          </div>
        </div>
      )}

      {/* 游戏区域 */}
      <div className="flex-1 flex flex-col justify-start py-2 mb-4">
        <StroopGame
          isActive={isPlaying}
          onAnswer={handleAnswer}
          currentQuestion={currentQuestion}
          totalQuestions={QUESTION_COUNT}
        />
      </div>

      {/* 控制按钮 */}
      <div className="flex justify-center gap-4">
        {!isPlaying && !showResult && (
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all active:scale-95 shadow-lg"
          >
            开始训练
          </button>
        )}

        {isPlaying && (
          <button
            onClick={() => {
              // 提前结束
              const correctCount = questions.filter(q => q.isCorrect).length;
              const avgReactionTime = questions.length > 0
                ? questions.reduce((sum, q) => sum + q.reactionTime, 0) / questions.length
                : 0;

              const score = questions.length > 0
                ? Math.round((correctCount / questions.length) * 500 + Math.max(0, 300 - avgReactionTime))
                : 0;

              const accuracy = questions.length > 0
                ? Math.round((correctCount / questions.length) * 100)
                : 0;

              endGame({
                score,
                accuracy,
                details: {
                  questionCount: questions.length,
                  correctCount,
                  avgReactionTime,
                  questions,
                },
              });

              setFinalScore(score);
              setShowResult(true);
            }}
            className="px-6 py-2 border border-border rounded-xl hover:bg-accent transition-all active:scale-95"
          >
            结束训练
          </button>
        )}

        {showResult && (
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all active:scale-95 shadow-lg"
          >
            再玩一次
          </button>
        )}
      </div>

      {/* 结果展示 */}
      {showResult && (
        <div className="mt-8 p-6 bg-surface-container-low rounded-2xl border border-border">
          <h3 className="text-lg font-semibold mb-4 text-center font-headline">训练完成！</h3>
          <ScoreBoard
            score={finalScore}
            accuracy={stats.accuracy}
          />
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div className="text-center">
              <div className="text-xs uppercase tracking-wider mb-1">总用时</div>
              <div className="text-lg font-bold text-foreground">{elapsedTime.toFixed(1)}s</div>
            </div>
            <div className="text-center">
              <div className="text-xs uppercase tracking-wider mb-1">平均反应</div>
              <div className="text-lg font-bold text-foreground">{Math.round(stats.avgReactionTime)}ms</div>
            </div>
            <div className="text-center">
              <div className="text-xs uppercase tracking-wider mb-1">正确率</div>
              <div className="text-lg font-bold text-foreground">{stats.correctCount}/{questions.length}</div>
            </div>
            <div className="text-center">
              <div className="text-xs uppercase tracking-wider mb-1">最快反应</div>
              <div className="text-lg font-bold text-foreground">
                {questions.length > 0 ? Math.min(...questions.map(q => q.reactionTime)) : 0}ms
              </div>
            </div>
          </div>

          {/* 反应时间趋势 */}
          {questions.length > 1 && (
            <div className="mt-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 text-center">
                反应时间趋势
              </div>
              <div className="flex items-end justify-between h-20 gap-1">
                {questions.map((q, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t ${q.isCorrect ? 'bg-primary/60' : 'bg-destructive/60'}`}
                    style={{ height: `${Math.min(100, (q.reactionTime / 2000) * 100)}%` }}
                    title={`题目 ${i + 1}: ${q.reactionTime}ms ${q.isCorrect ? '✓' : '✗'}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  </>
);
}
