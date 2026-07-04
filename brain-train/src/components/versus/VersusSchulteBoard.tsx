import { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface VersusSchulteBoardProps {
  grid: number[];          // 服务器下发的表
  size: number;            // 如 5（5x5）
  onTap: (cellIndex: number) => void;  // 点击上报（emit game:tap）
  disabled?: boolean;      // 倒计时/结束时禁用
}

// 舒尔特对战棋盘：grid 来自服务器，点击本地即时反馈 + 上报。
// 不本地算分（服务器权威）。本地 found 只用于决定「下一个该点的数」做视觉反馈。
export function VersusSchulteBoard({ grid, size, onTap, disabled = false }: VersusSchulteBoardProps) {
  // 本地已正确点数（只用于判断下一个该点的数 + 视觉）
  const foundRef = useRef(0);
  const [clickedCells, setClickedCells] = useState<Set<number>>(new Set());
  const [wrongCell, setWrongCell] = useState<number | null>(null);
  const wrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback((cellIndex: number) => {
    if (disabled) return;
    const expectedNumber = foundRef.current + 1;
    const tappedNumber = grid[cellIndex];

    // 无论对错都上报（服务器记分）
    onTap(cellIndex);

    if (tappedNumber === expectedNumber) {
      // 对：本地推进
      foundRef.current += 1;
      setClickedCells((prev) => new Set(prev).add(cellIndex));
    } else {
      // 错：震动反馈（不推进 found）
      setWrongCell(cellIndex);
      if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = setTimeout(() => setWrongCell(null), 450);
    }
  }, [disabled, grid, onTap]);

  return (
    <div className="flex items-center justify-center w-full">
      <div className="relative w-full max-w-md aspect-square bg-surface-container-low rounded-xl p-4 shadow-2xl">
        <div
          className="grid gap-3 h-full w-full"
          style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
        >
          {grid.map((number, cellIndex) => {
            const isClicked = clickedCells.has(cellIndex);
            const isWrong = wrongCell === cellIndex;
            return (
              <motion.button
                key={cellIndex}
                onClick={() => handleClick(cellIndex)}
                disabled={disabled || isClicked}
                // 震动用 framer-motion 的 x 关键帧；颜色绝不让 framer-motion 管——
                // 关键帧动画的终值会写进 inline style，且 isWrong 变 false 时
                // animate 里没有 backgroundColor 字段，framer-motion 不会清除它，
                // 导致格子残留淡红。颜色只由 className 决定，wrongCell 清空即恢复。
                animate={isWrong ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
                transition={isWrong ? { duration: 0.45 } : { duration: 0 }}
                className={`
                  flex items-center justify-center rounded-xl font-bold
                  transition-colors duration-150 cursor-pointer active:scale-95
                  ${isWrong
                    ? 'bg-red-500/30 text-red-600 ring-2 ring-red-500'
                    : isClicked
                      ? 'bg-primary/20 text-primary'
                      : 'bg-surface-container text-foreground hover:bg-surface-container-high shadow-sm'
                  }
                `}
                style={{ fontSize: size >= 6 ? '0.9rem' : undefined }}
              >
                {number}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
