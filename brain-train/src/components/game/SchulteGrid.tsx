import { useState, useCallback, useEffect, useMemo } from 'react';
import { seededShuffle } from '../../lib/rng';

interface SchulteGridProps {
  gridSize: 3 | 4 | 5 | 6;
  order: 'asc' | 'desc' | 'alternate' | 'mixed';
  expectedSequence?: number[];          // mixed 模式预设序列
  isActive: boolean;
  startTime: number;
  onCorrectClick: (number: number, time: number) => void;
  onWrongClick: () => void;
  onComplete?: () => void;
  onComboChange?: (combo: number) => void;
}

// 计算下一个目标数字的索引序列
function buildTargetSequence(
  gridSize: number,
  order: 'asc' | 'desc' | 'alternate' | 'mixed',
  expectedSequence?: number[]
): number[] {
  const N = gridSize * gridSize;
  if (order === 'asc') {
    return Array.from({ length: N }, (_, i) => i + 1);
  }
  if (order === 'desc') {
    return Array.from({ length: N }, (_, i) => N - i);
  }
  if (order === 'alternate') {
    // 1, N, 2, N-1, ...
    const seq: number[] = [];
    let lo = 1, hi = N;
    for (let i = 0; i < N; i++) {
      if (i % 2 === 0) {
        seq.push(lo++);
      } else {
        seq.push(hi--);
      }
    }
    return seq;
  }
  // mixed
  if (expectedSequence && expectedSequence.length === N) {
    return [...expectedSequence];
  }
  // 兜底（不该到这里）
  return Array.from({ length: N }, (_, i) => i + 1);
}

export function SchulteGrid({
  gridSize,
  order,
  expectedSequence,
  isActive,
  startTime,
  onCorrectClick,
  onWrongClick,
  onComplete,
  onComboChange,
}: SchulteGridProps) {
  const [clickedCount, setClickedCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(startTime);

  const N = gridSize * gridSize;

  // 生成乱序网格（仅位置乱序，数字本身按 targetSequence 顺序点）
  // 使用 startTime 作 seed 进行确定性洗牌（mulberry32），以便闯关模式重试时网格一致
  const gridNumbers = useMemo(() => {
    const arr = Array.from({ length: N }, (_, i) => i + 1);
    const seed = startTime % 4294967296;
    return seededShuffle(arr, seed);
  }, [N, startTime]);

  // 计算下一个目标数字
  const targetSequence = useMemo(
    () => buildTargetSequence(gridSize, order, expectedSequence),
    [gridSize, order, expectedSequence]
  );

  const expectedNumber = targetSequence[clickedCount];

  // 重置：startTime 变化时回到初始
  useEffect(() => {
    setClickedCount(0);
    setCombo(0);
    setLastClickTime(startTime);
    onComboChange?.(0);
  }, [startTime]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNumberClick = useCallback((number: number) => {
    if (!isActive) return;

    if (number === expectedNumber) {
      const currentTime = Date.now();
      const clickDuration = (currentTime - lastClickTime) / 1000;
      const newClicked = clickedCount + 1;
      const newCombo = combo + 1;
      setClickedCount(newClicked);
      setCombo(newCombo);
      setLastClickTime(currentTime);
      onCorrectClick(number, clickDuration);
      onComboChange?.(newCombo);

      if (newClicked === N) {
        onComplete?.();
      }
    } else {
      setCombo(0);
      onComboChange?.(0);
      onWrongClick();
    }
  }, [isActive, clickedCount, combo, expectedNumber, lastClickTime, N, onCorrectClick, onWrongClick, onComplete, onComboChange]);

  // 已经点过的数字集合（用于显示已点击状态）
  const clickedNumbers = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < clickedCount; i++) {
      set.add(targetSequence[i]);
    }
    return set;
  }, [clickedCount, targetSequence]);

  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="relative w-full max-w-md aspect-square bg-surface-container-low rounded-xl p-4 shadow-2xl">
        {/* 背景柔光 */}
        <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full pointer-events-none" />
        <div
          className="grid gap-3 h-full w-full relative z-10"
          style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
        >
          {gridNumbers.map((number) => {
            const isClicked = clickedNumbers.has(number);
            return (
              <button
                key={number}
                onClick={() => handleNumberClick(number)}
                disabled={!isActive || isClicked}
                className={`
                  flex items-center justify-center rounded-xl text-xl font-bold
                  transition-all duration-200 cursor-pointer active:scale-95
                  ${isClicked
                    ? 'bg-muted text-muted-foreground cursor-default'
                    : 'bg-surface-container text-foreground hover:bg-surface-container-high shadow-sm'
                  }
                `}
                style={{ fontSize: gridSize >= 6 ? '0.9rem' : undefined }}
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
