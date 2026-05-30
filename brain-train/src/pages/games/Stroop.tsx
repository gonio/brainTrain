import { useState, useCallback, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAudio } from '../../hooks/useAudio';
import { StroopGame } from '../../components/game/StroopGame';
import { ScoreBoard } from '../../components/game/ScoreBoard';
import { GameControlBar } from '../../components/game/GameControlBar';
import { GameStartScreen } from '../../components/game/GameStartScreen';
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
  const isPaused = status === 'paused';
  const isIdle = status === 'idle';

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

      // 0-100 分制：准确度 70% + 速度 30%
      const accuracyScore = (correctCount / QUESTION_COUNT) * 100;
      const speedScore = Math.max(0, 100 - (avgReactionTime - 300) / 10);
      const score = Math.min(100, Math.round(accuracyScore * 0.7 + speedScore * 0.3));

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
        {/* 游戏开始页面 */}
        {isIdle && !showResult && (
          <GameStartScreen
            mode="stroop"
            title="字色干扰"
            description="忽略文字含义，快速识别文字的颜色"
            onStart={handleStart}
          />
        )}

      {/* 游戏统计 */}
      {(isPlaying || isPaused) && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-accent rounded-xl">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">正确</div>
            <div className="text-xl font-bold font-headline">{stats.correctCount}</div>
          </div>
          <div className="text-center p-3 bg-accent rounded-xl">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">准确率</div>
            <div className="text-xl font-bold font-headline">{stats.accuracy}%</div>
          </div>
          <div className="text-center p-3 bg-accent rounded-xl">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">平均反应</div>
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
        {isPlaying && (
          <button
            onClick={() => {
              // 提前结束
              const correctCount = questions.filter(q => q.isCorrect).length;
              const avgReactionTime = questions.length > 0
                ? questions.reduce((sum, q) => sum + q.reactionTime, 0) / questions.length
                : 0;

              const score = questions.length > 0
                ? Math.min(100, Math.round(
                    (correctCount / questions.length) * 100 * 0.7
                    + Math.max(0, 100 - (avgReactionTime - 300) / 10) * 0.3
                  ))
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
