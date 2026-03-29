import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
}

export function SequenceGame({
  sequenceLength,
  onComplete,
  isActive
}: SequenceGameProps) {
  const [phase, setPhase] = useState<GamePhase>('memorize');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userSequence, setUserSequence] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // 生成序列（确保不重复）
  const sequence = useMemo(() => {
    const shuffled = [...ITEMS_POOL].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, sequenceLength);
  }, [sequenceLength, isActive]);

  // 打乱后的选项（用于回忆阶段）
  const shuffledOptions = useMemo(() => {
    return [...sequence].sort(() => Math.random() - 0.5);
  }, [sequence]);

  // 记忆阶段动画
  const handleMemorizeComplete = useCallback(() => {
    setPhase('recall');
    setCurrentIndex(0);
  }, []);

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
            {phase === 'recall' && `${userSequence.length} / ${sequence.length}`}
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
          <div className="aspect-square bg-surface-container-low dark:bg-[#131b2e] rounded-2xl flex items-center justify-center shadow-inner mb-4">
            <AnimatePresence mode="wait">
              {sequence.slice(0, currentIndex + 1).map((item, index) => (
                index === currentIndex && (
                  <motion.span
                    key={`${item}-${index}`}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-8xl"
                    onAnimationComplete={() => {
                      setTimeout(() => {
                        if (currentIndex < sequence.length - 1) {
                          setCurrentIndex(prev => prev + 1);
                        } else {
                          setTimeout(handleMemorizeComplete, 1000);
                        }
                      }, 800);
                    }}
                  >
                    {item}
                  </motion.span>
                )
              ))}
            </AnimatePresence>
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

export { ITEMS_POOL };
export type { GamePhase };
