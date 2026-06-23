import { motion, AnimatePresence } from 'framer-motion';

interface QuestHUDProps {
  level: number;
  direction: 'asc' | 'desc' | 'alternate' | 'mixed';
  lives: number;
  combo: number;
  remainingTime?: number;       // 总剩余秒，undefined = 无时限
  totalTime?: number;           // 总时间，用于计算百分比
  perNumberTime?: number;       // 当前数字的剩余秒
  perNumberTotal?: number;      // 每数字总时限（秒）
  currentTarget?: number | null; // 下一个应点的目标数字
  correctClickCount?: number;   // 已点对个数
  gridTotal?: number;           // 网格数字总数
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
  perNumberTime,
  perNumberTotal,
  currentTarget,
  correctClickCount = 0,
  gridTotal = 0,
}: QuestHUDProps) {
  const percent = totalTime && remainingTime !== undefined
    ? (remainingTime / totalTime) * 100
    : 100;
  const barColor = percent > 50 ? 'bg-green-500' : percent > 25 ? 'bg-yellow-500' : 'bg-red-500';

  // 每数字倒计时紧迫感：剩余 < 40% 进入警告，< 20% 进入危险（高频脉冲）
  const perPercent = perNumberTotal && perNumberTime !== undefined
    ? (perNumberTime / perNumberTotal) * 100
    : 100;
  const isDanger = perPercent <= 20;
  const isWarning = perPercent <= 40;

  // 当前步进方向标签（交替/混合关方向随步变化，仅在 asc/desc 固定显示）
  const stepDir: '正向' | '反向' | null = (() => {
    if (currentTarget == null) return null;
    if (direction === 'asc') return '正向';
    if (direction === 'desc') return '反向';
    return null; // alternate/mixed：方向随步变化，不显示固定标签
  })();

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

      {/* 每数字倒计时 + 下一个目标提示：紧凑一行，紧迫感强 */}
      {perNumberTime !== undefined && perNumberTotal && (
        <div className="flex items-center justify-between gap-3 mb-2 px-1">
          {/* 左：下一个目标 */}
          <div className="flex flex-col items-start">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              下一个
            </span>
            <div className="flex items-baseline gap-1.5">
              {stepDir && (
                <span className={`text-xs font-bold ${stepDir === '正向' ? 'text-emerald-500' : 'text-sky-500'}`}>
                  {stepDir}
                </span>
              )}
              <span className="text-2xl font-black font-headline text-primary leading-none">
                {currentTarget ?? '—'}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {correctClickCount}/{gridTotal}
            </span>
          </div>

          {/* 右：每数字倒计时圆环/数字，剩余少时高频脉冲 */}
          <motion.div
            className="flex items-center gap-2"
            animate={
              isDanger
                ? { scale: [1, 1.12, 1] }
                : { scale: 1 }
            }
            transition={isDanger ? { duration: 0.4, repeat: Infinity } : { duration: 0 }}
          >
            <div
              data-testid="per-number-time"
              className={`
                text-2xl font-black font-mono leading-none tabular-nums
                ${isDanger ? 'text-red-600' : isWarning ? 'text-amber-500' : 'text-foreground'}
              `}
            >
              {perNumberTime.toFixed(1)}
              <span className="text-xs text-muted-foreground">s</span>
            </div>
            {/* 每数字进度细条 */}
            <div className="w-16 h-1.5 bg-accent rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${isDanger ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-primary'}`}
                style={{ width: `${perPercent}%` }}
              />
            </div>
          </motion.div>
        </div>
      )}

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
