import { motion, AnimatePresence } from 'framer-motion';

interface QuestHUDProps {
  level: number;
  direction: 'asc' | 'desc' | 'alternate' | 'mixed';
  lives: number;
  combo: number;
  remainingTime?: number;       // 总剩余秒，undefined = 无时限
  totalTime?: number;           // 总时间，用于计算百分比
}

const DIRECTION_SHORT: Record<string, string> = {
  asc: '正向',
  desc: '反向',
  alternate: '交替',
  mixed: '混合',
};

export function QuestHUD({
  level,
  direction,
  lives,
  combo,
  remainingTime,
  totalTime,
}: QuestHUDProps) {
  const percent = totalTime && remainingTime !== undefined
    ? (remainingTime / totalTime) * 100
    : 100;
  const barColor = percent > 50 ? 'bg-green-500' : percent > 25 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="w-full max-w-md mx-auto px-4 py-3">
      {/* 顶部信息条 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold font-headline">L{level}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{DIRECTION_SHORT[direction]}</span>
        </div>

        {remainingTime !== undefined && (
          <div className="flex items-center gap-2 text-sm font-mono">
            <span>⏱</span>
            <span className="font-bold">{Math.ceil(remainingTime)}s</span>
          </div>
        )}

        <div className="flex items-center gap-1">
          {Array.from({ length: lives }).map((_, i) => (
            <span key={i} className="text-red-500">❤</span>
          ))}
        </div>
      </div>

      {/* 总时间条 */}
      {remainingTime !== undefined && (
        <div className="h-1.5 bg-accent rounded-full overflow-hidden mb-3">
          <div
            data-testid="time-bar"
            className={`h-full ${barColor} transition-all duration-300`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {/* 目标数字 / 方向 / 每数字倒计时 已移至棋盘上沿的浮动提示
          （SchulteGrid 的 TargetOverlay），紧贴棋盘、余光可见。
          这里只保留总时间、命数、combo。 */}

      {/* Combo 显示：固定高度槽位 + 绝对定位内容。
          首次出现/combo 更新时只有绝对定位元素在动，槽位高度恒定，
          不会把下方棋盘挤下去造成点击区域抖动。 */}
      <div className="relative h-14 mb-2">
        <AnimatePresence>
          {combo >= 5 && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              key={combo}
              className="absolute inset-0 flex flex-col items-center justify-center text-center"
            >
              <span className="text-xs font-bold text-primary uppercase tracking-[0.2em]">COMBO</span>
              <div className="text-3xl font-black font-headline text-primary leading-none">
                ×{combo}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
