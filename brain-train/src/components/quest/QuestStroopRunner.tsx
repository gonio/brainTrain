// Stroop 适配器：自带题目循环流程管理
//
// StroopGame 只渲染单题，完成流程在调用方管理（参考自由模式 Stroop.tsx）。
// 本 Runner 内部管理 currentQuestion/结束判定，渲染 StroopGame 单题组件。
import { useState, useCallback } from 'react';
import { StroopGame } from '@/components/game/StroopGame';
import { getDifficulty } from '@/lib/questGameConfig';
import { useAudio } from '@/hooks/useAudio';
import { useSettingsStore } from '@/stores/settingsStore';
import type { StroopDifficultyParams, QuestResult } from '@/types/quest';
import type { StroopQuestion } from '@/types';
import type { RunnerProps } from './QuestRunner';

export function QuestStroopRunner({ difficulty, onComplete }: RunnerProps) {
  const level = getDifficulty('stroop', difficulty);
  const { questionCount, mode, timePerQuestion } = level.params as StroopDifficultyParams;

  const [questions, setQuestions] = useState<StroopQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  const { soundEnabled } = useSettingsStore();
  const { playEffect } = useAudio();

  const handleAnswer = useCallback((question: StroopQuestion) => {
    const allQuestions = [...questions, question];
    setQuestions(allQuestions);

    if (soundEnabled) {
      playEffect(question.isCorrect ? 'tick' : 'wrong');
    }

    if (currentIdx + 1 >= questionCount) {
      // 全部答完，结算
      const correctCount = allQuestions.filter((q) => q.isCorrect).length;
      const accuracy = (correctCount / questionCount) * 100;
      const wrongCount = questionCount - correctCount;
      // 错题超限（≥ 题数一半）→ 失败
      const failed = wrongCount >= Math.ceil(questionCount / 2);
      let stars: 0 | 1 | 2 | 3 = 1;
      if (accuracy >= level.excellentThreshold) stars = 3;
      else if (accuracy >= level.goodThreshold) stars = 2;

      // 错题明细：供结算页展示对比。
      // correctAnswer / rule 由 StroopGame 在 onAnswer 时填好上抛。
      // rule（选颜色/选字义）必须带上，否则 dual 模式下用户看不懂对错。
      const errors = allQuestions
        .filter((q) => !q.isCorrect)
        .map((q) => ({
          word: q.word,
          wordColor: q.wordColor,
          userAnswer: q.userAnswer,
          correctAnswer: q.correctAnswer ?? '',
          rule: q.rule ?? 'standard',
        }));

      const result: QuestResult = {
        gameId: 'stroop',
        difficulty,
        passed: !failed,
        stars: failed ? 0 : stars,
        score: Math.round(accuracy),
        details: { questionCount, correctCount, accuracy, errors },
      };
      onComplete(result);
      if (soundEnabled) {
        playEffect(failed ? 'wrong' : 'complete');
      }
    } else {
      setCurrentIdx((i) => i + 1);
    }
  }, [questions, currentIdx, questionCount, level.goodThreshold, level.excellentThreshold, difficulty, onComplete, soundEnabled, playEffect]);

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
