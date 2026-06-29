import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { seededShuffle } from '../../lib/rng';
import { buildAlternateWithDirections, type StepDirection } from '../../lib/schulteQuestConfig';

interface SchulteGridProps {
  gridSize: 3 | 4 | 5 | 6;
  order: 'asc' | 'desc' | 'alternate' | 'mixed';
  expectedSequence?: number[];          // mixed 模式预设序列
  isActive: boolean;
  startTime: number;
  onCorrectClick: (number: number, time: number) => void;
  // 错点回调：带「点了哪个数字 / 当时应该点哪个」明细，结算页据此展示对比。
  // 旧调用方（不取参数）照常兼容。
  onWrongClick?: (info: { clicked: number; expected: number }) => void;
  onComplete?: () => void;
  onComboChange?: (combo: number) => void;
  // 下一个目标数字变化时通知（null = 已全部点完 / 交替模式不报具体数字）。用于 HUD。
  onTargetChange?: (target: number | null) => void;
  // 交替模式：当前方向（正/反）变化时通知。asc/desc 关不触发。
  onDirectionChange?: (dir: StepDirection | null) => void;
  // 紧贴棋盘的浮动目标提示（可选）。传入则在棋盘上沿叠加，余光可见、无需远眺。
  floatingTarget?: {
    target: number | null;              // 目标数字（交替模式为 null）
    direction: StepDirection | null;    // 交替模式方向
    perNumberTime?: number;             // 每数字倒计时
    perNumberTotal?: number;            // 每数字总时限
    isAlternate: boolean;
  };
}

// 计算下一个目标数字的索引序列
function buildTargetSequence(
  gridSize: number,
  order: 'asc' | 'desc' | 'alternate' | 'mixed',
  expectedSequence?: number[],
  seed?: number,
): number[] {
  const N = gridSize * gridSize;
  if (order === 'asc') {
    return Array.from({ length: N }, (_, i) => i + 1);
  }
  if (order === 'desc') {
    return Array.from({ length: N }, (_, i) => N - i);
  }
  if (order === 'alternate') {
    // 从两端往中间：正向段点 lo,lo+1,...；反向段点 hi,hi-1,...
    // 每段长度随机 1-4（确定性 RNG，保证重试可复现），段长点完后翻方向。
    return buildAlternateWithDirections(N, seed ?? 0).sequence;
  }
  // mixed：完全随机顺序。
  // 优先用外部传入的 expectedSequence；没传则用 seed 洗牌生成随机序列。
  // （之前没传时会兜底成 1,2,3...N 的正序，导致 mixed 实际退化成 asc。）
  //
  // 关键：网格位置（gridNumbers）也用 startTime 洗牌同一个 [1..N]。
  // mixed 的点击序列若用同一个 seed，会和网格排列完全一致——变成「按棋盘从左上到
  // 右下挨个点」，毫无难度。所以这里给 seed 加偏移，让两套洗牌相互独立。
  if (expectedSequence && expectedSequence.length === N) {
    return [...expectedSequence];
  }
  const base = Array.from({ length: N }, (_, i) => i + 1);
  return seededShuffle(base, (seed ?? 0) + 2654435761);
}

// 悬浮在棋盘正上方的目标/方向提示。完全脱离棋盘上沿（向上留出间距），
// 大号文字 + 正反异色，让玩家用余光即可判断当前目标/方向，无需远眺上方 HUD。
function TargetOverlay({
  target,
}: {
  target: NonNullable<SchulteGridProps['floatingTarget']>;
}) {
  const { target: num, direction, perNumberTime, perNumberTotal, isAlternate } = target;
  const perPercent = perNumberTotal && perNumberTime !== undefined
    ? (perNumberTime / perNumberTotal) * 100
    : 100;
  const isDanger = perPercent <= 20;
  const isWarning = perPercent <= 40;

  // 交替模式正/反用不同颜色：正向=蓝（primary，冷色/前进感），
  // 反向=橙红（暖色/反向感）。余光靠颜色即可区分方向，不必读字。
  // 倒计时危险态（≤20%）统一压成红色，覆盖方向色，强调「快超时」。
  const dirTone =
    direction === '正'
      ? 'bg-primary border-primary text-primary-foreground'
      : 'bg-orange-500 border-orange-400 text-white';
  const colorTone = isDanger
    ? 'bg-red-500 border-red-400 text-white'
    : isAlternate
      ? dirTone
      : isWarning
        ? 'bg-amber-400 border-amber-300 text-white'
        : 'bg-primary border-primary text-primary-foreground';

  return (
    <motion.div
      // key 变化触发淡入，强化「目标/方向变了」的感知
      key={isAlternate ? (direction ?? 'none') : (num ?? 'none')}
      initial={{ y: -6, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.18 }}
      // -top-14：卡片整体悬在棋盘上方（向上 56px），与棋盘留出明显间距，不再压住第一行格子。
      className={`absolute left-1/2 -translate-x-1/2 -top-14 z-20 flex items-center gap-3 px-6 py-2.5 rounded-full shadow-xl border-2 pointer-events-none ${colorTone}`}
    >
      {/* 目标数字 / 方向：大号、高对比，余光可读 */}
      {isAlternate ? (
        <span className="text-3xl font-black font-headline leading-none">
          {direction ?? '—'}
        </span>
      ) : (
        <span className="text-3xl font-black font-headline leading-none tabular-nums">
          {num ?? '—'}
        </span>
      )}
      {/* 倒计时小号紧贴，剩余少时不变色（整体卡片已变色） */}
      {perNumberTime !== undefined && (
        <span className="text-sm font-bold font-mono opacity-90 tabular-nums">
          {perNumberTime.toFixed(1)}s
        </span>
      )}
    </motion.div>
  );
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
  onDirectionChange,
  floatingTarget,
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

  // 计算下一个目标数字。交替模式额外算出每步方向（正/反）。
  const seedNum = startTime % 4294967296;
  const { targetSequence, alternateDirections } = useMemo(() => {
    if (order === 'alternate') {
      const { sequence, directions } = buildAlternateWithDirections(N, seedNum);
      return { targetSequence: sequence, alternateDirections: directions };
    }
    return {
      targetSequence: buildTargetSequence(gridSize, order, expectedSequence, seedNum),
      alternateDirections: null as StepDirection[] | null,
    };
  }, [gridSize, order, expectedSequence, N, seedNum]);

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

  // 向外报告「下一个目标数字」。交替模式不报具体数字（传 null），改由 onDirectionChange 报方向。
  useEffect(() => {
    if (order === 'alternate') {
      onTargetChange?.(null);
    } else {
      onTargetChange?.(clickedCount >= N ? null : targetSequence[clickedCount] ?? null);
    }
  }, [clickedCount, targetSequence, N, order, onTargetChange]);

  // 交替模式：报告当前方向（正/反），点完为 null。
  useEffect(() => {
    if (order !== 'alternate' || !alternateDirections) return;
    onDirectionChange?.(clickedCount >= N ? null : alternateDirections[clickedCount] ?? null);
  }, [clickedCount, alternateDirections, order, onDirectionChange, N]);

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
      onWrongClick?.({ clicked: number, expected: currentExpected });

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

        {/* 紧贴棋盘上沿的浮动目标提示：余光可见，无需远眺上方 HUD。
            紧贴棋盘边缘、高对比卡片，消除「数字离棋盘太远」的问题。 */}
        {floatingTarget && (
          <TargetOverlay target={floatingTarget} />
        )}

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
                // 震动用 framer-motion 的 x 关键帧；颜色绝不让 framer-motion 管——
                // 关键帧动画的终值会写进 inline style，且 isWrong 变 false 时
                // animate 里没有 backgroundColor 字段，framer-motion 不会清除它，
                // 导致格子残留淡红。颜色只由 className 决定，wrongNumber 清空即恢复。
                animate={
                  isWrong
                    ? { x: [0, -6, 6, -4, 4, 0] }
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
