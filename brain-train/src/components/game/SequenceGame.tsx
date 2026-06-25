import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// 可用物品池（emoji）
const ITEMS_POOL = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
  '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆',
  '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋',
  '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎',
  '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟',
  '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈',
  '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🍆', '🥔',
  '🥕', '🌽', '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄',
  '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
  '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
];

// 游戏阶段
type GamePhase = 'memorize' | 'recall' | 'result';

interface SequenceGameProps {
  sequenceLength: number;
  onComplete: (result: {
    sequence: string[];
    userSequence: string[];
    positionAccuracy: number;
    itemAccuracy: number;
  }) => void;
  isActive: boolean;
  displayMode?: 'step' | 'flash';    // step=逐个亮起（默认），flash=整段闪现
  distractors?: number;              // 回忆阶段混入的错误选项数（默认 0）
  answerTimeLimit?: number;          // 回忆阶段总限时秒数（默认无限制）
}

export function SequenceGame({
  sequenceLength,
  onComplete,
  isActive,
  displayMode = 'step',
  distractors = 0,
  answerTimeLimit,
}: SequenceGameProps) {
  const [phase, setPhase] = useState<GamePhase>('memorize');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userSequence, setUserSequence] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // 新局开始时重置所有内部状态（isActive false→true 触发）
  // 解决：再玩一次卡住、超时残留、连续局 state 污染
  useEffect(() => {
    if (!isActive) return;
    setPhase('memorize');
    setCurrentIndex(0);
    setUserSequence([]);
    setSelectedItems(new Set());
    setTimeLeft(null);
  }, [isActive]);

  // 生成序列（确保不重复）
  const sequence = useMemo(() => {
    const shuffled = [...ITEMS_POOL].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, sequenceLength);
  }, [sequenceLength, isActive]);

  // 打乱后的选项（用于回忆阶段）。distractors>0 时从池中混入错误选项作干扰
  const shuffledOptions = useMemo(() => {
    const baseOptions = [...sequence];
    if (distractors > 0) {
      const used = new Set(sequence);
      const pool = ITEMS_POOL.filter((item) => !used.has(item));
      const shuffledPool = [...pool].sort(() => Math.random() - 0.5);
      baseOptions.push(...shuffledPool.slice(0, distractors));
    }
    return baseOptions.sort(() => Math.random() - 0.5);
  }, [sequence, distractors]);

  // 记忆阶段动画
  const handleMemorizeComplete = useCallback(() => {
    setPhase('recall');
    setCurrentIndex(0);
  }, []);

  // step 模式记忆阶段推进：每个 item 显示 800ms 后进入下一个，最后一个再停 1s 后进回忆
  useEffect(() => {
    if (!isActive || phase !== 'memorize' || displayMode === 'flash') return;
    const isLast = currentIndex >= sequence.length - 1;
    const delay = isLast ? 1800 : 800; // 最后一个多停 1s 供记忆
    const timer = setTimeout(() => {
      if (isLast) {
        handleMemorizeComplete();
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [isActive, phase, displayMode, currentIndex, sequence.length, handleMemorizeComplete]);

  // 回忆阶段总倒计时（answerTimeLimit 存在时启用）。超时按当前已选序列结算
  useEffect(() => {
    if (phase !== 'recall' || !answerTimeLimit) return;
    setTimeLeft(answerTimeLimit);
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t === null) return null;
        if (t <= 1) {
          clearInterval(interval);
          // 超时：按当前已选序列结算（未选满的位置算错）
          let positionCorrect = 0;
          let itemCorrect = 0;
          const itemSet = new Set(sequence);
          userSequence.forEach((item, index) => {
            if (item === sequence[index]) positionCorrect++;
            if (itemSet.has(item)) itemCorrect++;
          });
          const positionAccuracy = Math.round((positionCorrect / sequence.length) * 100);
          const itemAccuracy = Math.round((itemCorrect / sequence.length) * 100);
          onComplete({ sequence, userSequence, positionAccuracy, itemAccuracy });
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, answerTimeLimit]);

  // 处理用户选择
  const handleItemSelect = useCallback((item: string) => {
    if (phase !== 'recall' || selectedItems.has(item)) return;

    const newUserSequence = [...userSequence, item];
    const newSelectedItems = new Set(selectedItems);
    newSelectedItems.add(item);

    setUserSequence(newUserSequence);
    setSelectedItems(newSelectedItems);

    // 检查是否完成
    if (newUserSequence.length === sequence.length) {
      // 计算准确率
      let positionCorrect = 0;
      let itemCorrect = 0;

      const itemSet = new Set(sequence);

      newUserSequence.forEach((item, index) => {
        if (item === sequence[index]) positionCorrect++;
        if (itemSet.has(item)) itemCorrect++;
      });

      const positionAccuracy = Math.round((positionCorrect / sequence.length) * 100);
      const itemAccuracy = Math.round((itemCorrect / sequence.length) * 100);

      onComplete({
        sequence,
        userSequence: newUserSequence,
        positionAccuracy,
        itemAccuracy,
      });
    }
  }, [phase, selectedItems, userSequence, sequence, onComplete]);

  // 如果游戏不活跃，显示提示
  if (!isActive) {
    return (
      <div className="w-full max-w-md mx-auto text-center py-12">
        <div className="text-6xl mb-4">🧠</div>
        <p className="text-muted-foreground">点击开始训练进入游戏</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* 阶段指示器 */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span>
            {phase === 'memorize' && '记忆阶段'}
            {phase === 'recall' && '回忆阶段'}
          </span>
          <span>
            {phase === 'memorize' && `${Math.min(currentIndex + 1, sequence.length)} / ${sequence.length}`}
            {phase === 'recall' && (answerTimeLimit && timeLeft !== null && timeLeft > 0
              ? `${timeLeft}s 剩余`
              : `${userSequence.length} / ${sequence.length}`)}
          </span>
        </div>
        <div className="h-2 bg-accent rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{
              width: phase === 'memorize'
                ? `${((currentIndex + 1) / sequence.length) * 100}%`
                : `${(userSequence.length / sequence.length) * 100}%`
            }}
          />
        </div>
      </div>

      {/* 记忆阶段 */}
      {phase === 'memorize' && (
        <div className="relative">
          <div className="aspect-square bg-surface-container-low rounded-2xl flex items-center justify-center shadow-inner mb-4">
            {displayMode === 'flash' ? (
              <FlashMemorize sequence={sequence} onDone={handleMemorizeComplete} />
            ) : (
              <motion.span
                key={currentIndex}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-8xl"
              >
                {sequence[currentIndex]}
              </motion.span>
            )}
          </div>
          <p className="text-center text-sm text-muted-foreground">
            记住物品出现的顺序
          </p>
        </div>
      )}

      {/* 回忆阶段 */}
      {phase === 'recall' && (
        <div>
          {/* 已选择的序列显示 */}
          <div className="mb-6">
            <p className="text-xs text-muted-foreground mb-2 text-center">
              按记忆顺序点击下方物品
            </p>
            <div className="flex justify-center gap-2 min-h-[60px]">
              {userSequence.map((item, index) => (
                <motion.div
                  key={`${item}-${index}`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center text-2xl",
                    "bg-primary text-primary-foreground shadow-md"
                  )}
                >
                  {item}
                </motion.div>
              ))}
              {/* 空白占位 */}
              {Array.from({ length: sequence.length - userSequence.length }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="w-12 h-12 rounded-xl border-2 border-dashed border-muted-foreground/30"
                />
              ))}
            </div>
          </div>

          {/* 选项网格 */}
          <div className="grid grid-cols-5 gap-3">
            {shuffledOptions.map((item) => {
              const isSelected = selectedItems.has(item);
              return (
                <motion.button
                  key={item}
                  onClick={() => handleItemSelect(item)}
                  disabled={isSelected}
                  whileHover={!isSelected ? { scale: 1.1 } : {}}
                  whileTap={!isSelected ? { scale: 0.95 } : {}}
                  className={cn(
                    "aspect-square rounded-xl text-3xl flex items-center justify-center",
                    "transition-all duration-200",
                    isSelected
                      ? "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                      : "bg-surface-container hover:bg-surface-container-high shadow-md hover:shadow-lg"
                  )}
                >
                  {item}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// flash 模式记忆阶段：整段序列同时显示 2 秒后结束
function FlashMemorize({ sequence, onDone }: { sequence: string[]; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="flex flex-wrap justify-center gap-3 p-4 max-w-md">
      {sequence.map((item, index) => (
        <motion.span
          key={`${item}-${index}`}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: index * 0.05 }}
          className="text-5xl"
        >
          {item}
        </motion.span>
      ))}
    </div>
  );
}

export { ITEMS_POOL };
export type { GamePhase };
