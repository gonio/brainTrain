import { useState } from 'react';
import { motion } from 'framer-motion';

const BOTTLE_STYLES: Record<string, string> = {
  red: 'linear-gradient(135deg, #fca5a5 0%, #dc2626 100%)',
  blue: 'linear-gradient(135deg, #93c5fd 0%, #2563eb 100%)',
  green: 'linear-gradient(135deg, #86efac 0%, #16a34a 100%)',
  yellow: 'linear-gradient(135deg, #fde047 0%, #ca8a04 100%)',
  purple: 'linear-gradient(135deg, #d8b4fe 0%, #9333ea 100%)',
  orange: 'linear-gradient(135deg, #fdba74 0%, #ea580c 100%)',
};

interface VersusBottleBoardProps {
  targetSequence: string[];
  initialSequence: string[];
  onSwap: (playerSequence: string[]) => void;
  disabled?: boolean;
}

export function VersusBottleBoard({ targetSequence, initialSequence, onSwap, disabled }: VersusBottleBoardProps) {
  const [playerSeq, setPlayerSeq] = useState<string[]>(initialSequence);
  const [selected, setSelected] = useState<number | null>(null);

  const handleClick = (index: number) => {
    if (disabled) return;
    if (selected === null) {
      setSelected(index);
    } else if (selected === index) {
      setSelected(null);
    } else {
      // 交换 selected 和 index
      const next = [...playerSeq];
      [next[selected], next[index]] = [next[index], next[selected]];
      setPlayerSeq(next);
      setSelected(null);
      onSwap(next);
    }
  };

  const matchedCount = playerSeq.filter((c, i) => c === targetSequence[i]).length;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 目标排列提示 */}
      <div className="flex flex-col items-center gap-1">
        <p className="text-xs text-gray-400">目标排列（从上到下）</p>
        <div className="flex gap-1">
          {targetSequence.map((c, i) => (
            <div key={i} className="h-3 w-6 rounded-sm" style={{ background: BOTTLE_STYLES[c] }} />
          ))}
        </div>
      </div>

      <p className="text-sm text-gray-500">已匹配 {matchedCount}/{targetSequence.length} · 点两个瓶子交换</p>

      {/* 瓶子（竖排）*/}
      <div className="flex flex-col-reverse gap-2">
        {playerSeq.map((color, i) => {
          const isMatched = color === targetSequence[i];
          const isSelected = selected === i;
          return (
            <motion.button
              key={i}
              layout
              onClick={() => handleClick(i)}
              animate={isSelected ? { scale: 1.1 } : { scale: 1 }}
              className={`relative h-14 w-14 rounded-lg ${isMatched ? 'ring-2 ring-green-400' : isSelected ? 'ring-2 ring-indigo-400' : ''}`}
              style={{ background: BOTTLE_STYLES[color] }}
            >
              {isMatched && <span className="absolute -right-1 -top-1 text-green-500">✓</span>}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
