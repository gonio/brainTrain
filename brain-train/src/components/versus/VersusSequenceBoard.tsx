import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface VersusSequenceBoardProps {
  sequence: string[];
  optionPool: string[];      // 序列 + 干扰的打乱池
  memorizeMs: number;
  recallTimeLimitMs: number;
  onSubmit: (userSequence: string[]) => void;
  disabled?: boolean;
}

type Phase = 'memorize' | 'recall';

export function VersusSequenceBoard({ sequence, optionPool, memorizeMs, recallTimeLimitMs, onSubmit, disabled }: VersusSequenceBoardProps) {
  const [phase, setPhase] = useState<Phase>('memorize');
  const [selected, setSelected] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(Math.round(recallTimeLimitMs / 1000));
  const submittedRef = useRef(false);

  // memorize 阶段计时
  useEffect(() => {
    const t = setTimeout(() => setPhase('recall'), memorizeMs);
    return () => clearTimeout(t);
  }, [memorizeMs]);

  // recall 阶段倒计时
  useEffect(() => {
    if (phase !== 'recall') return;
    const deadline = Date.now() + recallTimeLimitMs;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        doSubmit();
      }
    }, 250);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const doSubmit = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    // 补齐到 sequence.length（没选满的位置用空串）
    const padded = [...selected];
    while (padded.length < sequence.length) padded.push('');
    onSubmit(padded);
  };

  const handleSelect = (item: string) => {
    if (disabled || phase !== 'recall' || submittedRef.current) return;
    if (selected.length >= sequence.length) return;
    const next = [...selected, item];
    setSelected(next);
    if (next.length === sequence.length) {
      // 选满自动提交
      setTimeout(() => {
        submittedRef.current = true;
        onSubmit(next);
      }, 300);
    }
  };

  const handleUndo = () => {
    if (submittedRef.current) return;
    setSelected((prev) => prev.slice(0, -1));
  };

  if (phase === 'memorize') {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-gray-500">记住以下顺序（{Math.round(memorizeMs / 1000)}秒）</p>
        <div className="flex gap-2">
          {sequence.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.15 }}
              className="flex h-16 w-16 items-center justify-center rounded-xl bg-indigo-100 text-4xl dark:bg-indigo-900/30"
            >
              {item}
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-gray-500">回忆阶段 · 剩余 {timeLeft}s</p>

      {/* 已选序列槽位 */}
      <div className="flex gap-2">
        {Array.from({ length: sequence.length }).map((_, i) => (
          <div key={i} className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 text-4xl dark:border-gray-600">
            {selected[i] ?? ''}
          </div>
        ))}
      </div>

      {/* 选项池 */}
      <div className="grid grid-cols-4 gap-2">
        {optionPool.map((item, i) => (
          <button
            key={i}
            disabled={disabled}
            onClick={() => handleSelect(item)}
            className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 text-3xl hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            {item}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={handleUndo} disabled={selected.length === 0} className="rounded-lg bg-gray-200 px-4 py-2 text-sm disabled:opacity-40 dark:bg-gray-600">撤销</button>
        {selected.length === sequence.length && (
          <button onClick={() => { submittedRef.current = true; onSubmit(selected); }} className="rounded-lg bg-indigo-500 px-4 py-2 text-sm text-white">提交</button>
        )}
      </div>
    </div>
  );
}
