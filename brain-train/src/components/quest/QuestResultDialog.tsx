// 结算弹窗：星级动画 + 继续下一关 / 返回大厅
import { motion } from 'framer-motion';
import type { QuestResult, GameId } from '@/types/quest';

const GAME_NAMES: Record<GameId, string> = {
  schulte: '舒尔特表',
  sequence: '序列记忆',
  stroop: '字色干扰',
  bottle: '暗瓶排列',
};

interface QuestResultDialogProps {
  result: QuestResult;
  isCleared: boolean;   // 是否全游戏通关
  onNext: () => void;   // 继续下一关
  onHub: () => void;    // 返回大厅
}

export function QuestResultDialog({ result, isCleared, onNext, onHub }: QuestResultDialogProps) {
  return (
    <div className="max-w-md mx-auto text-center py-12">
      {isCleared && (
        <p className="text-2xl font-headline font-black text-success mb-2">🎉 主线全部通关！</p>
      )}
      <h2 className="font-headline text-3xl font-extrabold text-foreground mb-4">关卡完成！</h2>

      {/* 星级动画（逐颗点亮） */}
      <div className="flex justify-center gap-2 mb-4">
        {[1, 2, 3].map((n) => (
          <motion.span
            key={n}
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: n * 0.2, type: 'spring' }}
            className={`text-5xl ${n <= result.stars ? 'text-yellow-400' : 'text-muted-foreground/30'}`}
          >
            ★
          </motion.span>
        ))}
      </div>

      <p className="text-muted-foreground mb-8">
        {GAME_NAMES[result.gameId]} · 难度 {result.difficulty}
      </p>

      <div className="flex gap-3">
        <button
          onClick={onHub}
          className="flex-1 py-3 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors font-bold"
        >
          返回大厅
        </button>
        {!isCleared && (
          <button
            onClick={onNext}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-bold"
          >
            继续下一关
          </button>
        )}
      </div>
    </div>
  );
}
