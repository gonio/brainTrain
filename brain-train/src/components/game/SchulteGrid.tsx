import { useState, useCallback, useEffect, useMemo } from 'react';

interface SchulteGridProps {
  order: 'asc' | 'desc';
  onCorrectClick: (number: number, time: number) => void;
  onWrongClick: () => void;
  isActive: boolean;
  startTime: number;
}

const GRID_SIZE = 5;

export function SchulteGrid({
  order,
  onCorrectClick,
  onWrongClick,
  isActive,
  startTime
}: SchulteGridProps) {
  const [clickedNumbers, setClickedNumbers] = useState<Set<number>>(new Set());
  const [lastClickTime, setLastClickTime] = useState(startTime);

  // Generate shuffled grid
  const grid = useMemo(() => {
    const numbers = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => i + 1);
    // Fisher-Yates shuffle
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    return numbers;
  }, [startTime]);

  // Calculate expected next number
  const expectedNumber = useMemo(() => {
    if (order === 'asc') {
      return clickedNumbers.size + 1;
    } else {
      return GRID_SIZE * GRID_SIZE - clickedNumbers.size;
    }
  }, [clickedNumbers.size, order]);

  // Reset when game starts
  useEffect(() => {
    setClickedNumbers(new Set());
    setLastClickTime(startTime);
  }, [startTime]);

  const handleNumberClick = useCallback((number: number) => {
    if (!isActive || clickedNumbers.has(number)) return;

    const currentTime = Date.now();
    const clickDuration = (currentTime - lastClickTime) / 1000;

    if (number === expectedNumber) {
      setClickedNumbers(prev => new Set([...prev, number]));
      setLastClickTime(currentTime);
      onCorrectClick(number, clickDuration);
    } else {
      onWrongClick();
    }
  }, [isActive, clickedNumbers, expectedNumber, lastClickTime, onCorrectClick, onWrongClick]);

  return (
    <div className="relative w-full max-w-md aspect-square bg-surface-container-low dark:bg-[#131b2e] rounded-xl p-4 shadow-2xl mx-auto">
      {/* Subtle glow background effect */}
      <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full pointer-events-none" />

      <div
        className="grid gap-3 h-full w-full relative z-10"
        style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
      >
        {grid.map((number) => {
          const isClicked = clickedNumbers.has(number);

          return (
            <button
              key={number}
              onClick={() => handleNumberClick(number)}
              disabled={!isActive || isClicked}
              className={`
                flex items-center justify-center rounded-xl text-xl font-bold
                transition-all duration-200 cursor-pointer
                active:scale-95
                ${isClicked
                  ? 'bg-surface-container dark:bg-[#171f33]/50 text-muted-foreground cursor-default'
                  : 'bg-surface-container-highest dark:bg-[#2d3449] text-slate-900 dark:text-[#dae2fd] hover:bg-surface-bright dark:hover:bg-[#31394d]'
                }
              `}
            >
              {number}
            </button>
          );
        })}
      </div>
    </div>
  );
}
