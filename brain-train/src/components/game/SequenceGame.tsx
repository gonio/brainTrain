import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// 固定物品集（12 个）：序列与干扰项都从这 12 个里选。
// 挑选原则——主导色互不重复、形态分明（动物/水果/物品混搭），
// 让玩家靠颜色 + 轮廓即可一眼区分，无需辨认相似图案。
//   🐶 棕黄  🐱 灰   🐰 白   🦊 橙   🐸 绿   🐧 黑白
//   🍎 红    🍋 亮黄  🍇 紫   🫐 深蓝  🍑 粉   🐝 黄黑条纹
const ITEMS_POOL = [
  '🐶', '🐱', '🐰', '🦊', '🐸', '🐧',
  '🍎', '🍋', '🍇', '🫐', '🍑', '🐝',
];

// 游戏阶段
type GamePhase = 'memorize' | 'recall' | 'result';

// 统一计算本局结果（选满/超时共用）。
// - 位置准确率：每个位置用户答案 == 正确答案算 1
// - 物品准确率：仅在有干扰项时有意义（用户是否选到了正确物品）；
//   无干扰项时选项池 == 序列本身，物品必然全对，恒为 100。
function computeResult(
  sequence: string[],
  userSequence: string[],
  distractors: number,
) {
  let positionCorrect = 0;
  const itemSet = new Set(sequence);
  userSequence.forEach((item, index) => {
    if (item === sequence[index]) positionCorrect++;
  });

  const positionAccuracy = Math.round((positionCorrect / sequence.length) * 100);
  const itemAccuracy =
    distractors > 0
      ? Math.round(
          (userSequence.filter((item) => itemSet.has(item)).length /
            sequence.length) *
            100,
        )
      : 100;

  return {
    sequence,
    userSequence,
    positionAccuracy,
    itemAccuracy,
    hasDistractors: distractors > 0,
  };
}

interface SequenceGameProps {
  sequenceLength: number;
  onComplete: (result: {
    sequence: string[];
    userSequence: string[];
    positionAccuracy: number;
    itemAccuracy: number;          // 有干扰项时才有意义；无干扰项时恒为 100
    hasDistractors: boolean;       // 本次回忆阶段是否含干扰项（评分依据）
  }) => void;
  isActive: boolean;
  displayMode?: 'step' | 'flash';    // step=逐个亮起（默认），flash=整段闪现
  distractors?: number;              // 回忆阶段混入的错误选项数（默认 0）
  answerTimeLimit?: number;          // 回忆阶段总限时秒数（默认无限制）
  stepDurationMs?: number;           // step 模式每个 item 的显示时长（默认 1200ms）
  flashDurationMs?: number;          // flash 模式整段显示时长（默认按序列长度算）
}

export function SequenceGame({
  sequenceLength,
  onComplete,
  isActive,
  displayMode = 'step',
  distractors = 0,
  answerTimeLimit,
  stepDurationMs = 1200,
  flashDurationMs,
}: SequenceGameProps) {
  const [phase, setPhase] = useState<GamePhase>('memorize');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userSequence, setUserSequence] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // 新局开始时重置所有内部状态（isActive false→true 触发）
  // 解决：再玩一次卡住、超时残留、连续局 state 污染
  useEffect(() => {
    if (!isActive) return;
    setPhase('memorize');
    setCurrentIndex(0);
    setUserSequence([]);
    setTimeLeft(null);
  }, [isActive]);

  // 生成序列（确保不重复）
  const sequence = useMemo(() => {
    const shuffled = [...ITEMS_POOL].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, sequenceLength);
  }, [sequenceLength, isActive]);

  // flash 模式显示时长：默认按序列长度给（每项 700ms + 1200ms 基础），
  // 让长序列（6-9 个）也有足够时间记忆，而非写死的过短 2 秒。
  const flashMs = useMemo(
    () => flashDurationMs ?? sequence.length * 700 + 1200,
    [flashDurationMs, sequence.length],
  );

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

  // step 模式记忆阶段推进：每个 item 显示 stepDurationMs，最后一个播完立即进入回忆阶段
  useEffect(() => {
    if (!isActive || phase !== 'memorize' || displayMode === 'flash') return;
    const isLast = currentIndex >= sequence.length - 1;
    const timer = setTimeout(() => {
      if (isLast) {
        handleMemorizeComplete();
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
    }, stepDurationMs);
    return () => clearTimeout(timer);
  }, [isActive, phase, displayMode, currentIndex, sequence.length, stepDurationMs, handleMemorizeComplete]);

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
          onComplete(computeResult(sequence, userSequence, distractors));
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, answerTimeLimit]);

  // 处理用户选择（同一物品在无干扰项时可被重复选中——撤销后可选回）
  const handleItemSelect = useCallback((item: string) => {
    if (phase !== 'recall') return;
    if (userSequence.length >= sequence.length) return;
    // 有干扰项时每个物品只能选一次（去重）；无干扰项时不限制（选项即序列）
    if (distractors > 0 && userSequence.includes(item)) return;

    const newUserSequence = [...userSequence, item];
    setUserSequence(newUserSequence);

    // 选满即结算
    if (newUserSequence.length === sequence.length) {
      onComplete(computeResult(sequence, newUserSequence, distractors));
    }
  }, [phase, userSequence, sequence.length, distractors, onComplete]);

  // 撤销最后一次选择
  const handleUndo = useCallback(() => {
    if (phase !== 'recall' || userSequence.length === 0) return;
    setUserSequence((prev) => prev.slice(0, -1));
  }, [phase, userSequence.length]);

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
              <FlashMemorize sequence={sequence} onDone={handleMemorizeComplete} durationMs={flashMs} />
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
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">
                按记忆顺序点击下方物品
              </p>
              <button
                onClick={handleUndo}
                disabled={userSequence.length === 0}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-md transition-all flex items-center gap-1",
                  userSequence.length === 0
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-primary hover:bg-primary/10"
                )}
              >
                ↶ 撤销
              </button>
            </div>
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
              // 有干扰项时已选物品置灰；无干扰项时不限制重复选（撤销后可重新选）
              const isUsed = distractors > 0 && userSequence.includes(item);
              return (
                <motion.button
                  key={item}
                  onClick={() => handleItemSelect(item)}
                  disabled={isUsed}
                  whileHover={!isUsed ? { scale: 1.1 } : {}}
                  whileTap={!isUsed ? { scale: 0.95 } : {}}
                  className={cn(
                    "aspect-square rounded-xl text-3xl flex items-center justify-center",
                    "transition-all duration-200",
                    isUsed
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

// flash 模式记忆阶段：整段序列同时显示一段时间后结束。
// 时间按序列长度计算——序列越长，需要越多时间记忆。
// 写死 2 秒会让长序列（6-9 个）根本记不住，所以默认用「每项 700ms + 1200ms 基础」。
function FlashMemorize({
  sequence,
  onDone,
  durationMs,
}: {
  sequence: string[];
  onDone: () => void;
  durationMs: number;
}) {
  useEffect(() => {
    const timer = setTimeout(onDone, durationMs);
    return () => clearTimeout(timer);
  }, [onDone, durationMs]);

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
