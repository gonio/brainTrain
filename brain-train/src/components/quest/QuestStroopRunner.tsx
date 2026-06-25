// Stroop 适配器：自带题目循环流程管理
//
// StroopGame 只渲染单题，完成流程在调用方管理（参考自由模式 Stroop.tsx）。
// 本 Runner 内部管理 currentQuestion/结束判定，渲染 StroopGame 单题组件。
import { useState, useCallback } from 'react';
import { StroopGame } from '@/components/game/StroopGame';
import { getDifficulty } from '@/lib/questGameConfig';
import type { StroopDifficultyParams, QuestResult } from '@/types/quest';
import type { StroopQuestion } from '@/types';
import type { RunnerProps } from './QuestRunner';

export function QuestStroopRunner({ difficulty, onComplete }: RunnerProps) {
  const level = getDifficulty('stroop', difficulty);
  const { questionCount, mode, timePerQuestion } = level.params as StroopDifficultyParams;

  const [questions, setQuestions] = useState<StroopQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  const handleAnswer = useCallback((question: StroopQuestion) => {
    const allQuestions = [...questions, question];
    setQuestions(allQuestions);

    if (currentIdx + 1 >= questionCount) {
      // 全部答完，结算
      const correctCount = allQuestions.filter((q) => q.isCorrect).length;
      const accuracy = (correctCount / questionCount) * 100;
      let stars: 0 | 1 | 2 | 3 = 1;
      if (accuracy >= level.excellentThreshold) stars = 3;
      else if (accuracy >= level.goodThreshold) stars = 2;

      const result: QuestResult = {
        gameId: 'stroop',
        difficulty,
        passed: true,
        stars,
        score: Math.round(accuracy),
        details: { questionCount, correctCount, accuracy },
      };
      onComplete(result);
    } else {
      setCurrentIdx((i) => i + 1);
    }
  }, [questions, currentIdx, questionCount, level.goodThreshold, level.excellentThreshold, difficulty, onComplete]);

  return (
    <StroopGame
      isActive={true}
      onAnswer={handleAnswer}
      currentQuestion={currentIdx}
      totalQuestions={questionCount}
      mode={mode}
      timePerQuestion={timePerQuestion}
    />
  );
}
