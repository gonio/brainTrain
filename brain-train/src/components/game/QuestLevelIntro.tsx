import { motion } from 'framer-motion';
import { getLevelConfig } from '../../lib/schulteQuestConfig';

interface QuestLevelIntroProps {
  level: number;
  onStart: () => void;
}

// 方向标签映射（不含具体数字，数字由调用处动态拼接）
const DIRECTION_LABELS: Record<string, string> = {
  asc: '正向',
  desc: '反向',
  alternate: '正反交替',
  mixed: '混合',
};

// 交替/混合方向的玩法说明（替代旧的固定序列示例）。返回多行说明，帮助玩家理解规则。
function buildDirectionTip(direction: string): string[] {
  if (direction === 'alternate') {
    return [
      '看 HUD 的「正/反」方向提示',
      '正向从小往大点，反向从大往小点',
      '每点 1-4 个会随机翻转方向',
    ];
  }
  if (direction === 'mixed') {
    return ['随机顺序，每一步看屏幕提示'];
  }
  return [];
}

export function QuestLevelIntro({ level, onStart }: QuestLevelIntroProps) {
  const config = getLevelConfig(level);

  // 防御性：配置不存在时返回 null
  if (!config) {
    return null;
  }

  const N = config.gridSize * config.gridSize;
  const directionTips = buildDirectionTip(config.direction);

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
            {config.direction === 'asc' && `（1→${N}）`}
            {config.direction === 'desc' && `（${N}→1）`}
          </span>
        </div>
        {directionTips.length > 0 && (
          <div className="flex flex-col gap-1 pt-1">
            <span className="text-muted-foreground">玩法</span>
            {directionTips.map((tip, i) => (
              <span key={i} className="font-bold text-xs leading-relaxed">· {tip}</span>
            ))}
          </div>
        )}
        {config.timeLimitPerNumber && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">时限</span>
            <span className="font-bold">每数字 {config.timeLimitPerNumber} 秒（屏幕显示倒计时）</span>
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
