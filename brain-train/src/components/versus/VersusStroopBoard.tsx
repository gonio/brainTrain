import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { StroopQuestionDef } from '@/types/versus';
import { STROOP_COLORS } from '@/lib/versusColors';

interface VersusStroopBoardProps {
  questions: StroopQuestionDef[];
  timePerQuestionSec: number;
  onAnswer: (questionIndex: number, answer: string) => void;
  disabled?: boolean;
}

export function VersusStroopBoard({ questions, timePerQuestionSec, onAnswer, disabled }: VersusStroopBoardProps) {
  const [current, setCurrent] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [timeLeft, setTimeLeft] = useState(timePerQuestionSec);

  const q = questions[current];

  // 每题倒计时
  useEffect(() => {
    setTimeLeft(timePerQuestionSec);
    const deadline = Date.now() + timePerQuestionSec * 1000;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        handleAnswer('');
      }
    }, 250);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const handleAnswer = (answer: string) => {
    if (disabled || feedback) return;
    onAnswer(current, answer);
    const isCorrect = answer === q.correctAnswer;
    setFeedback(isCorrect ? 'correct' : 'wrong');
    setTimeout(() => {
      setFeedback(null);
      if (current + 1 < questions.length) {
        setCurrent((c) => c + 1);
      }
    }, 200);
  };

  // 找 wordColor 对应的颜色值
  const colorConfig = STROOP_COLORS.find((c) => c.name === q.wordColor);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* 进度 */}
      <div className="text-sm text-gray-500">
        第 {current + 1} / {questions.length} 题 · 剩余 {timeLeft}s
        {q.rule === 'standard' ? '（选颜色）' : '（选字义）'}
      </div>

      {/* 题目：字面 q.word，用 q.wordColor 颜色显示 */}
      <motion.div
        animate={feedback === 'correct' ? { scale: [1, 1.1, 1] } : feedback === 'wrong' ? { x: [0, -8, 8, 0] } : {}}
        transition={{ duration: 0.2 }}
        className="flex h-32 w-64 items-center justify-center rounded-2xl bg-gray-50 text-5xl font-bold dark:bg-gray-800"
        style={{ color: colorConfig?.value }}
      >
        {q.word}
      </motion.div>

      {/* 答案选项：6 个颜色按钮 */}
      <div className="grid grid-cols-3 gap-3">
        {STROOP_COLORS.map((c) => (
          <button
            key={c.name}
            disabled={disabled || !!feedback}
            onClick={() => handleAnswer(c.name)}
            className="rounded-lg py-3 text-white font-medium"
            style={{ backgroundColor: c.value }}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
