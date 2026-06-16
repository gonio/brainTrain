import { motion } from 'framer-motion';
import { getLevelConfig } from '../../lib/schulteQuestConfig';

interface QuestLevelIntroProps {
  level: number;
  onStart: () => void;
}

// 方向标签映射
const DIRECTION_LABELS: Record<string, string> = {
  asc: '正向（1→N）',
  desc: '反向（N→1）',
  alternate: '正反交替',
  mixed: '混合（开局展示）',
};

export function QuestLevelIntro({ level, onStart }: QuestLevelIntroProps) {
  const config = getLevelConfig(level);

  // 防御性：配置不存在时返回 null
  if (!config) {
    return null;
  }

  const N = config.gridSize * config.gridSize;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto p-6 bg-surface-container-low rounded-2xl shadow-lg"
    >
      <h2 className="text-center font-headline text-2xl font-extrabold mb-4">
        第 {level} 关
      </h2>

      <div className="space-y-2 mb-6 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">网格</span>
          <span className="font-bold">{config.gridSize}×{config.gridSize}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">方向</span>
          <span className="font-bold">
            {DIRECTION_LABELS[config.direction]}
            {config.direction === 'desc' && `（${N}→1）`}
          </span>
        </div>
        {config.timeLimitPerNumber && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">时限</span>
            <span className="font-bold">每数字 {config.timeLimitPerNumber} 秒</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">命数</span>
          <span className="font-bold">{config.lives} 命</span>
        </div>
      </div>

      <div className="bg-accent/30 rounded-xl p-4 mb-6 space-y-1.5">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">星级目标</p>
        <p className="text-sm">⭐ 通关</p>
        <p className="text-sm">⭐⭐ combo ≥ {config.comboTarget}</p>
        <p className="text-sm">⭐⭐⭐ 零错误</p>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onStart}
        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-lg shadow-lg hover:bg-primary/90 transition-all"
      >
        开始
      </motion.button>
    </motion.div>
  );
}
