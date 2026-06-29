// 开局倒计时缓冲遮罩：所有游戏「开始训练/下一关」后，先显示 3-2-1 倒计时再正式开始。
// 配套 hook 见 src/hooks/useStartCountdown.ts。
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

/**
 * 倒计时遮罩。
 *  - count>0：显示数字；count<=0：隐藏
 *  - onSkip：点击跳过（立即开始）
 */
export function StartCountdown({
  count,
  onSkip,
}: {
  count: number;
  onSkip: () => void;
}) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          onClick={onSkip}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer select-none bg-surface/95 backdrop-blur-sm"
        >
          <p className="absolute top-6 text-xs text-muted-foreground">
            点击任意位置可立即开始
          </p>
          <motion.div
            key={count}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className={cn(
              'font-headline font-extrabold leading-none',
              'text-primary drop-shadow-lg',
              'text-[14rem] sm:text-[18rem]',
            )}
          >
            {count}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
