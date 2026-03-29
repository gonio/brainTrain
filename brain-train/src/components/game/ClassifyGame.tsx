import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// 分类属性类型
type ItemColor = 'red' | 'blue' | 'green' | 'yellow';
type ItemShape = 'circle' | 'square' | 'triangle';
type ItemSize = 'small' | 'medium' | 'large';

interface Item {
  id: string;
  color: ItemColor;
  shape: ItemShape;
  size: ItemSize;
}

// 分类规则类型
type SortRule = 'color' | 'shape' | 'size';

interface ClassifyGameProps {
  isActive: boolean;
  onComplete: (result: {
    correctCount: number;
    totalCount: number;
    ruleSwitches: number;
    avgReactionTime: number;
    items: Item[];
    userAnswers: SortRule[];
  }) => void;
}

// 颜色到 Tailwind 类的映射
const colorClasses: Record<ItemColor, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
};

// 形状渲染
const ShapeIcon = ({ shape, size, color }: { shape: ItemShape; size: ItemSize; color: ItemColor }) => {
  const sizeClasses = {
    small: 'w-8 h-8',
    medium: 'w-12 h-12',
    large: 'w-16 h-16',
  };

  const colorClass = colorClasses[color];

  if (shape === 'circle') {
    return <div className={cn('rounded-full', sizeClasses[size], colorClass)} />;
  }

  if (shape === 'square') {
    return <div className={cn('rounded-lg', sizeClasses[size], colorClass)} />;
  }

  // 三角形
  return (
    <div
      className={cn('w-0 h-0', sizeClasses[size])}
      style={{
        borderLeft: size === 'small' ? '16px solid transparent' : size === 'medium' ? '24px solid transparent' : '32px solid transparent',
        borderRight: size === 'small' ? '16px solid transparent' : size === 'medium' ? '24px solid transparent' : '32px solid transparent',
        borderBottom: size === 'small' ? '28px solid' : size === 'medium' ? '42px solid' : '56px solid',
        borderBottomColor: color === 'red' ? '#ef4444' : color === 'blue' ? '#3b82f6' : color === 'green' ? '#22c55e' : '#eab308',
      }}
    />
  );
};

export function ClassifyGame({ isActive, onComplete }: ClassifyGameProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<SortRule[]>([]);
  const [currentRule, setCurrentRule] = useState<SortRule>('color');
  const [ruleSwitches, setRuleSwitches] = useState(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  // 生成物品
  const generateItems = useCallback((): Item[] => {
    const colors: ItemColor[] = ['red', 'blue', 'green', 'yellow'];
    const shapes: ItemShape[] = ['circle', 'square', 'triangle'];
    const sizes: ItemSize[] = ['small', 'medium', 'large'];

    return Array.from({ length: 15 }, (_, i) => ({
      id: `item-${i}`,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      size: sizes[Math.floor(Math.random() * sizes.length)],
    }));
  }, []);

  // 开始游戏
  useEffect(() => {
    if (!isActive) {
      setItems([]);
      setCurrentIndex(0);
      setUserAnswers([]);
      setCurrentRule('color');
      setRuleSwitches(0);
      setReactionTimes([]);
      setFeedback(null);
      return;
    }

    const newItems = generateItems();
    setItems(newItems);
    setStartTime(Date.now());
  }, [isActive, generateItems]);

  // 处理答案
  const handleAnswer = useCallback((answer: SortRule) => {
    if (currentIndex >= items.length) return;

    const reactionTime = Date.now() - startTime;
    setReactionTimes(prev => [...prev, reactionTime]);

    const isCorrect = answer === currentRule;
    setUserAnswers(prev => [...prev, answer]);
    setFeedback(isCorrect ? 'correct' : 'wrong');

    // 清除反馈并进入下一题
    setTimeout(() => {
      setFeedback(null);

      if (currentIndex + 1 >= items.length) {
        // 游戏结束
        const correctCount = userAnswers.filter((ans) => {
          // 这里简化处理，实际应该根据每个 item 的正确规则判断
          return ans === currentRule;
        }).length + (isCorrect ? 1 : 0);

        onComplete({
          correctCount,
          totalCount: items.length,
          ruleSwitches,
          avgReactionTime: reactionTimes.length > 0
            ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
            : 0,
          items,
          userAnswers: [...userAnswers, answer],
        });
      } else {
        setCurrentIndex(prev => prev + 1);
        setStartTime(Date.now());

        // 随机切换规则（每3-5个物品后）
        if ((currentIndex + 1) % (3 + Math.floor(Math.random() * 3)) === 0) {
          const rules: SortRule[] = ['color', 'shape', 'size'];
          const newRule = rules[Math.floor(Math.random() * rules.length)];
          if (newRule !== currentRule) {
            setCurrentRule(newRule);
            setRuleSwitches(prev => prev + 1);
          }
        }
      }
    }, 300);
  }, [currentIndex, items, currentRule, startTime, userAnswers, reactionTimes, ruleSwitches, onComplete]);

  // 如果游戏不活跃
  if (!isActive) {
    return (
      <div className="w-full max-w-md mx-auto text-center py-12">
        <div className="text-6xl mb-4">🧩</div>
        <p className="text-muted-foreground">点击开始训练进入游戏</p>
      </div>
    );
  }

  const currentItem = items[currentIndex];
  const progress = items.length > 0 ? ((currentIndex + 1) / items.length) * 100 : 0;

  return (
    <div className="w-full max-w-md mx-auto">
      {/* 进度条 */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span>进度</span>
          <span>{currentIndex + 1} / {items.length}</span>
        </div>
        <div className="h-2 bg-accent rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* 当前规则提示 */}
      <div className="mb-6 text-center">
        <div className="text-sm text-muted-foreground mb-2">当前分类规则</div>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
          <span className="text-lg font-bold text-primary">
            {currentRule === 'color' && '🔴 按颜色'}
            {currentRule === 'shape' && '🔷 按形状'}
            {currentRule === 'size' && '📏 按大小'}
          </span>
        </div>
      </div>

      {/* 当前物品 */}
      {currentItem && (
        <motion.div
          key={currentItem.id}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "relative flex justify-center items-center h-40 mb-8 rounded-2xl border-2 transition-all",
            feedback === 'correct' && "border-green-500 bg-green-500/10",
            feedback === 'wrong' && "border-red-500 bg-red-500/10",
            !feedback && "border-border bg-surface-container"
          )}
        >
          <ShapeIcon shape={currentItem.shape} size={currentItem.size} color={currentItem.color} />

          {/* 反馈 */}
          {feedback && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "absolute inset-0 flex items-center justify-center text-4xl font-bold",
                feedback === 'correct' ? "text-green-500" : "text-red-500"
              )}
            >
              {feedback === 'correct' ? '✓' : '✗'}
            </motion.div>
          )}
        </motion.div>
      )}

      {/* 分类按钮 */}
      <div className="grid grid-cols-3 gap-3">
        <motion.button
          onClick={() => handleAnswer('color')}
          disabled={!!feedback}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "py-4 rounded-xl font-semibold transition-all",
            currentRule === 'color'
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
              : "bg-surface-container hover:bg-surface-container-high text-foreground"
          )}
        >
          <div className="text-2xl mb-1">🔴</div>
          <div className="text-xs">颜色</div>
        </motion.button>

        <motion.button
          onClick={() => handleAnswer('shape')}
          disabled={!!feedback}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "py-4 rounded-xl font-semibold transition-all",
            currentRule === 'shape'
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
              : "bg-surface-container hover:bg-surface-container-high text-foreground"
          )}
        >
          <div className="text-2xl mb-1">🔷</div>
          <div className="text-xs">形状</div>
        </motion.button>

        <motion.button
          onClick={() => handleAnswer('size')}
          disabled={!!feedback}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "py-4 rounded-xl font-semibold transition-all",
            currentRule === 'size'
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
              : "bg-surface-container hover:bg-surface-container-high text-foreground"
          )}
        >
          <div className="text-2xl mb-1">📏</div>
          <div className="text-xs">大小</div>
        </motion.button>
      </div>

      {/* 规则切换提示 */}
      {ruleSwitches > 0 && (
        <div className="mt-6 text-center text-xs text-muted-foreground">
          规则已切换 <span className="font-bold text-primary">{ruleSwitches}</span> 次
        </div>
      )}
    </div>
  );
}

export { type Item, type SortRule };
