import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
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
  // 下一个目标数字变化时通知（null = 已全部点完）。用于 HUD 显示「下一个」提示。
  onTargetChange?: (target: number | null) => void;
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
  onTargetChange,
}: SchulteGridProps) {
  const [clickedCount, setClickedCount] = useState(0);
  // 错点反馈：记录最近一次点错的数字，触发该格震动+红闪。一定时间后自动清除。
  const [wrongNumber, setWrongNumber] = useState<number | null>(null);
  const wrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 使用 ref 同步跟踪点击状态，避免快速连点时闭包值过期。
  // combo / lastClickTime 仅由 ref 维护（旧版 useState 已移除——它们从不被读取，
  // 却会在每次点击触发无意义的重渲染）。
  const clickStateRef = useRef({ clickedCount: 0, combo: 0, lastClickTime: startTime });

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

  // 重置：startTime 变化时回到初始
  useEffect(() => {
    setClickedCount(0);
    setWrongNumber(null);
    if (wrongTimerRef.current) {
      clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = null;
    }
    clickStateRef.current = { clickedCount: 0, combo: 0, lastClickTime: startTime };
    onComboChange?.(0);
  }, [startTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // 向外报告「下一个目标数字」，供 HUD 实时提示当前方向与目标。点完为 null。
  useEffect(() => {
    onTargetChange?.(clickedCount >= N ? null : targetSequence[clickedCount] ?? null);
  }, [clickedCount, targetSequence, N, onTargetChange]);

  // 卸载时清理错点定时器，避免对已卸载组件 setState
  useEffect(() => {
    return () => {
      if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
    };
  }, []);

  const handleNumberClick = useCallback((number: number) => {
    if (!isActive) return;

    const state = clickStateRef.current;
    const currentExpected = targetSequence[state.clickedCount];

    if (number === currentExpected) {
      const currentTime = Date.now();
      const clickDuration = (currentTime - state.lastClickTime) / 1000;
      const newClicked = state.clickedCount + 1;
      const newCombo = state.combo + 1;

      // 先同步更新 ref，再触发 React 渲染
      clickStateRef.current = { clickedCount: newClicked, combo: newCombo, lastClickTime: currentTime };
      setClickedCount(newClicked);
      onCorrectClick(number, clickDuration);
      onComboChange?.(newCombo);

      if (newClicked === N) {
        onComplete?.();
      }
    } else {
      clickStateRef.current = { ...state, combo: 0 };
      onComboChange?.(0);
      onWrongClick();

      // 错点视觉反馈：震动 + 红闪，450ms 后自动恢复
      setWrongNumber(number);
      if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = setTimeout(() => setWrongNumber(null), 450);
    }
  }, [isActive, targetSequence, N, onCorrectClick, onWrongClick, onComplete, onComboChange]);

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
            const isWrong = wrongNumber === number;
            return (
              <motion.button
                key={number}
                onClick={() => handleNumberClick(number)}
                disabled={!isActive || isClicked}
                animate={
                  isWrong
                    ? { x: [0, -6, 6, -4, 4, 0], backgroundColor: ['rgb(239 68 68 / 0.35)', 'rgb(239 68 68 / 0.15)'] }
                    : { x: 0 }
                }
                transition={isWrong ? { duration: 0.45 } : { duration: 0 }}
                className={`
                  flex items-center justify-center rounded-xl text-xl font-bold
                  transition-colors duration-150 cursor-pointer active:scale-95
                  ${isWrong
                    ? 'bg-red-500/30 text-red-600 ring-2 ring-red-500'
                    : isClicked
                      ? 'bg-muted text-muted-foreground cursor-default'
                      : 'bg-surface-container text-foreground hover:bg-surface-container-high shadow-sm'
                  }
                `}
                style={{ fontSize: gridSize >= 6 ? '0.9rem' : undefined }}
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
