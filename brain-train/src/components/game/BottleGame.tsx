import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { shuffle, countMatches, computeOptimalSwaps } from '../../lib/bottleUtils';

// 瓶子颜色定义 - 渐变玻璃质感
const BOTTLE_COLORS = [
  { id: 'red', gradient: 'linear-gradient(135deg, #fca5a5 0%, #dc2626 100%)', label: '红' },
  { id: 'blue', gradient: 'linear-gradient(135deg, #93c5fd 0%, #2563eb 100%)', label: '蓝' },
  { id: 'green', gradient: 'linear-gradient(135deg, #86efac 0%, #16a34a 100%)', label: '绿' },
  { id: 'yellow', gradient: 'linear-gradient(135deg, #fde047 0%, #ca8a04 100%)', label: '黄' },
  { id: 'purple', gradient: 'linear-gradient(135deg, #d8b4fe 0%, #9333ea 100%)', label: '紫' },
  { id: 'orange', gradient: 'linear-gradient(135deg, #fdba74 0%, #ea580c 100%)', label: '橙' },
  { id: 'cyan', gradient: 'linear-gradient(135deg, #67e8f9 0%, #0891b2 100%)', label: '青' },
  { id: 'pink', gradient: 'linear-gradient(135deg, #f9a8d4 0%, #db2777 100%)', label: '粉' },
  { id: 'brown', gradient: 'linear-gradient(135deg, #d97706 0%, #78350f 100%)', label: '棕' },
];

const COLOR_MAP = Object.fromEntries(BOTTLE_COLORS.map(c => [c.id, c]));

interface DragInfo {
  sourceIndex: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isDragging: boolean;
}

interface BottleGameProps {
  bottleCount: number;
  isActive: boolean;
  startTime: number;
  onSwap: (matchCount: number) => void;
  onComplete: (totalSwaps: number, optimalSwaps: number, targetSeq: string[], playerSeq: string[]) => void;
}

export function BottleGame({ bottleCount, isActive, startTime, onSwap, onComplete }: BottleGameProps) {
  const [playerSequence, setPlayerSequence] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [matchCount, setMatchCount] = useState(0);
  // 拖拽态：坐标 + 源格子索引。作为 state 而非 ref，render 时不读 ref（符合 react-hooks/refs）。
  const [drag, setDrag] = useState<{ x: number; y: number; sourceIndex: number } | null>(null);

  const swapCountRef = useRef(0);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  // 仅在事件 handler 中读写的拖拽中间态：源索引、起点、是否真拖拽。
  const dragInfoRef = useRef<DragInfo | null>(null);
  const selectedRef = useRef<number | null>(null);
  const hadDragRef = useRef(false);

  // 生成目标序列和初始玩家序列。startTime 作为生成标识：每局变化即重新生成。
  const { target, initialPlayer, optimal } = useMemo(() => {
    const selectedColors = BOTTLE_COLORS.slice(0, bottleCount).map(c => c.id);
    // startTime 仅用于触发每局重新生成（不参与洗牌，洗牌刻意保留随机性）
    void startTime;
    const targetSeq = shuffle(selectedColors);
    let playerSeq = shuffle(selectedColors);
    while (countMatches(targetSeq, playerSeq) === bottleCount) {
      playerSeq = shuffle(playerSeq);
    }
    return {
      target: targetSeq,
      initialPlayer: playerSeq,
      optimal: computeOptimalSwaps(targetSeq, playerSeq),
    };
  }, [startTime, bottleCount]);

  // 重置状态
  useEffect(() => {
    setPlayerSequence(initialPlayer);
    setMatchCount(countMatches(target, initialPlayer));
    swapCountRef.current = 0;
    setSelectedIndex(null);
    selectedRef.current = null;
    setDrag(null);
    dragInfoRef.current = null;
  }, [startTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // 交换两个位置的瓶子
  const swapBottles = useCallback((indexA: number, indexB: number) => {
    if (indexA === indexB) return;

    const next = [...playerSequence];
    [next[indexA], next[indexB]] = [next[indexB], next[indexA]];

    setPlayerSequence(next);
    setSelectedIndex(null);
    selectedRef.current = null;

    swapCountRef.current += 1;
    const matches = countMatches(target, next);
    setMatchCount(matches);
    onSwap(matches);

    if (matches === bottleCount) {
      setTimeout(() => {
        onComplete(swapCountRef.current, optimal, target, next);
      }, 400);
    }
  }, [playerSequence, target, bottleCount, optimal, onSwap, onComplete]);

  // 根据指针坐标查找目标槽位
  const findTargetSlot = useCallback((x: number, y: number): number | null => {
    for (let i = 0; i < slotRefs.current.length; i++) {
      const rect = slotRefs.current[i]?.getBoundingClientRect();
      if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return i;
      }
    }
    return null;
  }, []);

  // 自定义拖拽 — 使用 ref 避免闭包过期问题

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isActive) return;
    const slot = (e.target as HTMLElement).closest('[data-slot]');
    if (!slot) return;
    const index = parseInt(slot.getAttribute('data-slot')!);
    gameAreaRef.current?.setPointerCapture(e.pointerId);
    dragInfoRef.current = {
      sourceIndex: index,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      isDragging: false,
    };
    // 不在这里清除 selectedIndex — 等 pointermove 确认是拖拽后再清除
  }, [isActive]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const info = dragInfoRef.current;
    if (!info) return;
    const dx = Math.abs(e.clientX - info.startX);
    const dy = Math.abs(e.clientY - info.startY);
    const isDragging = info.isDragging || dx > 5 || dy > 5;
    info.currentX = e.clientX;
    info.currentY = e.clientY;
    info.isDragging = isDragging;
    if (isDragging) {
      if (!hadDragRef.current) {
        hadDragRef.current = true;
        setSelectedIndex(null);
        selectedRef.current = null;
      }
      setDrag({ x: e.clientX, y: e.clientY, sourceIndex: info.sourceIndex });
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const info = dragInfoRef.current;
    if (!info) return;
    dragInfoRef.current = null;
    hadDragRef.current = false;
    gameAreaRef.current?.releasePointerCapture(e.pointerId);

    if (info.isDragging) {
      setDrag(null);
      const targetSlot = findTargetSlot(e.clientX, e.clientY);
      if (targetSlot !== null && targetSlot !== info.sourceIndex) {
        swapBottles(info.sourceIndex, targetSlot);
      }
    } else {
      // tap：使用 ref 避免闭包过期
      const prev = selectedRef.current;
      if (prev === null) {
        selectedRef.current = info.sourceIndex;
        setSelectedIndex(info.sourceIndex);
      } else if (prev === info.sourceIndex) {
        selectedRef.current = null;
        setSelectedIndex(null);
      } else {
        selectedRef.current = null;
        swapBottles(prev, info.sourceIndex);
      }
    }
  }, [findTargetSlot, swapBottles]);

  // 根据瓶子数量计算尺寸
  const bottleWidth = bottleCount <= 4 ? 56 : bottleCount <= 6 ? 44 : 36;
  const bottleHeight = bottleCount <= 4 ? 72 : bottleCount <= 6 ? 56 : 44;
  const gap = bottleCount <= 4 ? 12 : bottleCount <= 6 ? 8 : 6;

  const isDragging = drag !== null;
  const dragSourceIndex = drag?.sourceIndex ?? null;

  if (playerSequence.length === 0) return null;

  return (
    <div
      ref={gameAreaRef}
      className="flex flex-col items-center gap-6 w-full touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* 匹配计数 */}
      <div className="text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1 block">
          匹配
        </span>
        <span className="text-3xl font-black font-headline text-primary">
          {matchCount}<span className="text-lg text-muted-foreground">/{bottleCount}</span>
        </span>
      </div>

      {/* 上排 - 可见瓶子（玩家操作） */}
      <div className="flex justify-center items-end" style={{ gap }}>
        {playerSequence.map((colorId, index) => (
          <div
            key={`slot-${index}`}
            ref={el => { slotRefs.current[index] = el; }}
            data-slot={index}
            className="flex items-center justify-center"
            style={{ width: bottleWidth, height: bottleHeight + 8 }}
          >
            <motion.div
              layout
              layoutId={`bottle-${colorId}-${startTime}`}
              className={`
                relative rounded-2xl overflow-hidden shadow-lg
                transition-shadow duration-200
                ${selectedIndex === index ? 'ring-3 ring-primary shadow-primary/30' : ''}
              `}
              style={{
                width: bottleWidth,
                height: bottleHeight,
                background: COLOR_MAP[colorId]?.gradient,
                opacity: isDragging && dragSourceIndex === index ? 0.3 : 1,
              }}
            >
              {/* 高光效果 */}
              <div
                className="absolute bg-white/25 rounded-full -rotate-12 pointer-events-none"
                style={{
                  top: bottleCount <= 4 ? 6 : 4,
                  left: bottleCount <= 4 ? 6 : 3,
                  width: bottleCount <= 4 ? 10 : 7,
                  height: bottleCount <= 4 ? 24 : 16,
                }}
              />
              {/* 瓶口 */}
              <div
                className="absolute left-1/2 -translate-x-1/2 rounded-t-md bg-white/20"
                style={{
                  top: -3,
                  width: bottleCount <= 4 ? 16 : 12,
                  height: bottleCount <= 4 ? 8 : 6,
                }}
              />
            </motion.div>
          </div>
        ))}
      </div>

      {/* 下排 - 隐藏瓶子 */}
      <div className="flex justify-center items-start" style={{ gap }}>
        {target.map((_, index) => (
          <div
            key={`hidden-${index}`}
            className="relative rounded-2xl overflow-hidden"
            style={{
              width: bottleWidth,
              height: bottleHeight,
              background: 'linear-gradient(135deg, rgba(148,163,184,0.15) 0%, rgba(71,85,105,0.25) 100%)',
              border: '1px dashed rgba(148,163,184,0.3)',
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-slate-400/30" style={{ fontSize: bottleCount <= 4 ? 20 : 14 }}>?</span>
            </div>
          </div>
        ))}
      </div>

      {/* 拖拽时的浮动幽灵瓶 */}
      {isDragging && dragSourceIndex != null && (
        <div
          className="fixed pointer-events-none z-50 rounded-2xl shadow-xl"
          style={{
            left: drag!.x - bottleWidth / 2,
            top: drag!.y - bottleHeight / 2,
            width: bottleWidth,
            height: bottleHeight,
            background: COLOR_MAP[playerSequence[dragSourceIndex]]?.gradient,
            opacity: 0.85,
            transform: 'scale(1.1)',
          }}
        >
          <div
            className="absolute bg-white/30 rounded-full -rotate-12"
            style={{
              top: bottleCount <= 4 ? 6 : 4,
              left: bottleCount <= 4 ? 6 : 3,
              width: bottleCount <= 4 ? 10 : 7,
              height: bottleCount <= 4 ? 24 : 16,
            }}
          />
          <div
            className="absolute left-1/2 -translate-x-1/2 rounded-t-md bg-white/25"
            style={{
              top: -3,
              width: bottleCount <= 4 ? 16 : 12,
              height: bottleCount <= 4 ? 8 : 6,
            }}
          />
        </div>
      )}
    </div>
  );
}
