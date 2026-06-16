import { motion, AnimatePresence } from 'framer-motion';

interface QuestHUDProps {
  level: number;
  direction: 'asc' | 'desc' | 'alternate' | 'mixed';
  lives: number;
  combo: number;
  remainingTime?: number;       // 秒，undefined = 无时限
  totalTime?: number;           // 总时间，用于计算百分比
}

const DIRECTION_SHORT: Record<string, string> = {
  asc: '正向',
  desc: '反向',
  alternate: '交替',
  mixed: '混合',
};

export function QuestHUD({ level, direction, lives, combo, remainingTime, totalTime }: QuestHUDProps) {
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

      {/* 时间条 */}
      {remainingTime !== undefined && (
        <div className="h-1.5 bg-accent rounded-full overflow-hidden mb-3">
          <div
            data-testid="time-bar"
            className={`h-full ${barColor} transition-all duration-300`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {/* Combo 显示 */}
      <AnimatePresence>
        {combo >= 5 && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            key={combo}
            className="text-center mb-2"
          >
            <span className="text-xs font-bold text-primary uppercase tracking-[0.2em]">COMBO</span>
            <div className="text-3xl font-black font-headline text-primary">
              ×{combo}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
