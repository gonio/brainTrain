import { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { StroopQuestion } from '@/types';

// 颜色配置：名称、显示颜色值、色盲辅助形状
interface ColorConfig {
  name: string;           // 颜色名称（如"红色"）
  value: string;          // CSS 颜色值
  bgClass: string;        // Tailwind 背景类
  textClass: string;      // Tailwind 文字类
  shape: string;          // 色盲辅助形状
}

const COLORS: ColorConfig[] = [
  { name: '红色', value: '#ef4444', bgClass: 'bg-red-500', textClass: 'text-red-500', shape: '●' },
  { name: '蓝色', value: '#3b82f6', bgClass: 'bg-blue-500', textClass: 'text-blue-500', shape: '■' },
  { name: '绿色', value: '#22c55e', bgClass: 'bg-green-500', textClass: 'text-green-500', shape: '▲' },
  { name: '黄色', value: '#eab308', bgClass: 'bg-yellow-500', textClass: 'text-yellow-500', shape: '◆' },
  { name: '紫色', value: '#a855f7', bgClass: 'bg-purple-500', textClass: 'text-purple-500', shape: '★' },
  { name: '橙色', value: '#f97316', bgClass: 'bg-orange-500', textClass: 'text-orange-500', shape: '●' },
];

interface StroopGameProps {
  isActive: boolean;
  onAnswer: (question: StroopQuestion) => void;
  currentQuestion: number;
  totalQuestions: number;
}

export function StroopGame({
  isActive,
  onAnswer,
  currentQuestion,
  totalQuestions
}: StroopGameProps) {
  const [questionStartTime, setQuestionStartTime] = useState(0);

  // 生成当前题目
  const current = useMemo(() => {
    // 随机选择文字（颜色名称）
    const wordColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    // 随机选择显示颜色（可以与文字不同）
    let displayColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    // 确保不一致率约 70%
    if (Math.random() < 0.7) {
      while (displayColor.name === wordColor.name) {
        displayColor = COLORS[Math.floor(Math.random() * COLORS.length)];
      }
    } else {
      // 30% 概率一致
      displayColor = wordColor;
    }

    setQuestionStartTime(Date.now());

    return {
      word: wordColor.name,
      wordColorValue: displayColor.value,
      wordColorName: displayColor.name,
    };
  }, [currentQuestion]);

  const handleAnswer = useCallback((selectedColorName: string) => {
    if (!isActive) return;

    const reactionTime = Date.now() - questionStartTime;
    const isCorrect = selectedColorName === current.wordColorName;

    onAnswer({
      word: current.word,
      wordColor: current.wordColorName,
      userAnswer: selectedColorName,
      reactionTime,
      isCorrect,
    });
  }, [current, isActive, onAnswer, questionStartTime]);

  return (
    <div className="w-full max-w-md mx-auto">
      {/* 进度指示 */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span>题目 {currentQuestion + 1} / {totalQuestions}</span>
          <span>选择文字的颜色</span>
        </div>
        <div className="h-2 bg-accent rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentQuestion + 1) / totalQuestions) * 100}%` }}
          />
        </div>
      </div>

      {/* 颜色词显示区域 */}
      <div className="relative mb-8">
        <div className="aspect-video bg-surface-container-low dark:bg-[#131b2e] rounded-2xl flex items-center justify-center shadow-inner">
          <span
            className="text-6xl font-black font-headline tracking-wider"
            style={{ color: current.wordColorValue }}
          >
            {current.word}
          </span>
        </div>
        {/* 提示文字 */}
        <p className="text-center text-xs text-muted-foreground mt-3">
          忽略文字含义，选择<span className="font-bold text-foreground">文字的颜色</span>
        </p>
      </div>

      {/* 颜色选项按钮 */}
      <div className="grid grid-cols-3 gap-3">
        {COLORS.map((color) => (
          <button
            key={color.name}
            onClick={() => handleAnswer(color.name)}
            disabled={!isActive}
            className={cn(
              "relative p-4 rounded-xl border-2 transition-all duration-200",
              "hover:scale-105 active:scale-95",
              "flex flex-col items-center gap-2",
              "bg-surface-container dark:bg-[#1a2235] border-border",
              "hover:border-primary/50 hover:bg-surface-container-high",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            )}
          >
            {/* 颜色形状（色盲辅助） */}
            <span
              className="text-2xl"
              style={{ color: color.value }}
            >
              {color.shape}
            </span>
            {/* 颜色名称 */}
            <span className="text-xs font-medium text-foreground">
              {color.name}
            </span>
            {/* 颜色指示条 */}
            <div
              className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl"
              style={{ backgroundColor: color.value }}
            />
          </button>
        ))}
      </div>

      {/* 无障碍说明 */}
      <p className="text-center text-[10px] text-muted-foreground mt-4">
        不同形状代表不同颜色，帮助色盲用户识别
      </p>
    </div>
  );
}

export { COLORS };
export type { ColorConfig };
