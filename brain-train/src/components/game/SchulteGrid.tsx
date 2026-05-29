import { useState, useCallback, useEffect, useMemo } from 'react';

interface SchulteGridProps {
  order: 'asc' | 'desc';
  onCorrectClick: (number: number, time: number) => void;
  onWrongClick: () => void;
  onComplete?: () => void;
  isActive: boolean;
  startTime: number;
}

const GRID_SIZE = 5;

export function SchulteGrid({
  order,
  onCorrectClick,
  onWrongClick,
  onComplete,
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
      const newClicked = new Set([...clickedNumbers, number]);
      setClickedNumbers(newClicked);
      setLastClickTime(currentTime);
      onCorrectClick(number, clickDuration);

      // 在点击回调中直接检查完成（避免 useEffect 竞态）
      if (newClicked.size === GRID_SIZE * GRID_SIZE) {
        onComplete?.();
      }
    } else {
      onWrongClick();
    }
  }, [isActive, clickedNumbers, expectedNumber, lastClickTime, onCorrectClick, onWrongClick, onComplete]);

  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="relative w-full max-w-md aspect-square bg-surface-container-low rounded-xl p-4 shadow-2xl">
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
                    ? 'bg-muted text-muted-foreground cursor-default'
                    : 'bg-surface-container text-foreground hover:bg-surface-container-high shadow-sm'
                  }
                `}
              >
                {number}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
