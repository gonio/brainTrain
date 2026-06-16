import { motion } from 'framer-motion';

type DialogProps =
  | {
      type: 'pass';
      level: number;
      stars: 0 | 1 | 2 | 3;
      score: number;
      maxCombo: number;
      completionTime: number;
      isLastLevel: boolean;
      onNext: () => void;
      onRetry: () => void;
    }
  | {
      type: 'fail';
      level: number;
      maxCombo: number;
      progressText: string;
      onRetry: () => void;
      onExit: () => void;
    }
  | {
      type: 'completed';
      totalStars: number;
      totalTime: number;        // 秒
      onRestart: () => void;
    };

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m} 分 ${s} 秒`;
}

export function QuestResultDialog(props: DialogProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-surface rounded-2xl p-6 max-w-sm w-full shadow-2xl"
      >
        {props.type === 'pass' && <PassContent {...props} />}
        {props.type === 'fail' && <FailContent {...props} />}
        {props.type === 'completed' && <CompletedContent {...props} />}
      </motion.div>
    </motion.div>
  );
}

function PassContent({
  stars, score, maxCombo, completionTime, isLastLevel, onNext, onRetry,
}: Extract<DialogProps, { type: 'pass' }>) {
  return (
    <>
      <h3 className="text-center text-2xl font-extrabold font-headline mb-4">🎉 通关！</h3>
      <div className="flex justify-center gap-2 mb-4">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`text-3xl ${i <= stars ? '' : 'opacity-20 grayscale'}`}
          >
            ⭐
          </span>
        ))}
      </div>
      <div className="space-y-1 text-sm mb-6">
        <div className="flex justify-between">
          <span className="text-muted-foreground">得分</span>
          <span className="font-bold">{score}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">最高 combo</span>
          <span className="font-bold">×{maxCombo}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">用时</span>
          <span className="font-bold">{completionTime.toFixed(1)}s</span>
        </div>
      </div>
      <div className="flex gap-3">
        {!isLastLevel && (
          <button
            onClick={onNext}
            className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90"
          >
            下一关
          </button>
        )}
        <button
          onClick={onRetry}
          className="flex-1 py-3 bg-accent text-foreground rounded-xl font-bold hover:bg-accent/80"
        >
          重玩
        </button>
      </div>
    </>
  );
}

function FailContent({
  progressText, maxCombo, onRetry, onExit,
}: Extract<DialogProps, { type: 'fail' }>) {
  return (
    <>
      <h3 className="text-center text-2xl font-extrabold font-headline mb-4">💥 失败</h3>
      <div className="space-y-1 text-sm mb-6">
        <div className="flex justify-between">
          <span className="text-muted-foreground">关卡进度</span>
          <span className="font-bold">{progressText}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">最高 combo</span>
          <span className="font-bold">×{maxCombo}</span>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90"
        >
          重试本关
        </button>
        <button
          onClick={onExit}
          className="flex-1 py-3 bg-accent text-foreground rounded-xl font-bold hover:bg-accent/80"
        >
          退出
        </button>
      </div>
    </>
  );
}

function CompletedContent({
  totalStars, totalTime, onRestart,
}: Extract<DialogProps, { type: 'completed' }>) {
  return (
    <>
      <h3 className="text-center text-2xl font-extrabold font-headline mb-4">🏆 全部通关！</h3>
      <div className="space-y-1 text-sm mb-6">
        <div className="flex justify-between">
          <span className="text-muted-foreground">总星数</span>
          <span className="font-bold">⭐ {totalStars}/30</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">总用时</span>
          <span className="font-bold">{formatTime(totalTime)}</span>
        </div>
      </div>
      <button
        onClick={onRestart}
        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90"
      >
        重新挑战
      </button>
    </>
  );
}
