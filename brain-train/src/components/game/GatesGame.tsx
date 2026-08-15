// 逻辑门：看 elkjs 电路图，推出最终输出是 0 还是 1。
// 单题渲染器：由 LogicSessionShell 驱动（每题 3 次机会，答对或机会用完时上抛一次结果）。
import { lazy, Suspense, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { generateGatesCircuit, evaluateCircuit } from '../../lib/logic/gatesEngine';
import { MAX_ATTEMPTS } from '../../lib/logic/attempts';
import { useAudio } from '../../hooks/useAudio';
import type { LogicRoundProps } from './LogicSessionShell';

// 电路图依赖 elkjs（体积大），懒加载拆成独立异步 chunk，不胀主包
const GatesDiagram = lazy(() => import('./GatesDiagram'));

type Verdict = 'correct' | 'wrong' | null;

export function GatesGame({ engineLevel, isActive, rng, onRoundEnd }: LogicRoundProps) {
  const { playEffect } = useAudio();
  // 同一次挂载内题目固定：rng 只在首次渲染消费一次
  const circuit = useMemo(() => generateGatesCircuit(engineLevel, rng), [engineLevel, rng]);
  const answer = useMemo(() => evaluateCircuit(circuit), [circuit]);
  const [attempts, setAttempts] = useState(0); // 已用作答次数
  const [verdict, setVerdict] = useState<Verdict>(null); // 最后一次作答对错
  const [ended, setEnded] = useState(false); // 本题已结算（忽略后续点击）
  const [lastPick, setLastPick] = useState<boolean | null>(null); // 最后一次点的是哪个按钮（标红用）

  const handlePick = (choice: boolean) => {
    if (ended || !isActive) return;
    setLastPick(choice);
    const used = attempts + 1;
    // 音效归属约定：终结音效（答对/机会用完）由 LogicSessionShell 播，组件只在非终结答错时播 wrong
    if (choice === answer) {
      setVerdict('correct');
      setEnded(true);
      onRoundEnd({ correct: true, attempts: used });
      return;
    }
    setVerdict('wrong');
    if (used >= MAX_ATTEMPTS) {
      setEnded(true);
      onRoundEnd({ correct: false, attempts: MAX_ATTEMPTS });
      return;
    }
    playEffect('wrong');
    setAttempts(used); // 还有剩余机会，提示「再想想」
  };

  // 按钮反馈色：答对高亮所选，答错标红所选
  const buttonClass = (choice: boolean) => {
    const base =
      'flex-1 py-4 rounded-2xl font-headline text-2xl font-bold border transition-all disabled:cursor-default';
    if (verdict === null || (verdict === 'wrong' && choice !== lastPick)) {
      return `${base} bg-surface border-border hover:bg-accent/60`;
    }
    if (choice === answer && ended) return `${base} bg-primary text-primary-foreground border-primary`;
    if (choice === lastPick && verdict === 'wrong') return `${base} bg-red-500/20 border-red-500/40`;
    return `${base} bg-surface border-border`;
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-foreground font-headline font-bold text-center">
        所有输入如图所示，输出是 0 还是 1？
      </p>

      {/* 电路图（懒加载；结算后 verdict 上抛，图上高亮正确输出） */}
      <div className="w-full p-4 bg-surface rounded-2xl border border-border">
        <Suspense fallback={<div className="h-64 animate-pulse bg-surface-container rounded-2xl" />}>
          <GatesDiagram circuit={circuit} verdict={ended ? verdict : null} answer={answer} />
        </Suspense>
      </div>

      {/* 两个大按钮：0 / 1 */}
      <div className="w-full flex gap-4">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => handlePick(false)}
          disabled={ended || !isActive}
          className={buttonClass(false)}
        >
          0
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => handlePick(true)}
          disabled={ended || !isActive}
          className={buttonClass(true)}
        >
          1
        </motion.button>
      </div>

      {/* 剩余机会 / 作答反馈 / 谜底 */}
      <div className="h-6 text-sm text-center">
        {ended ? (
          <span className={verdict === 'correct' ? 'text-primary font-bold' : 'text-red-500 font-bold'}>
            输出其实是 {answer ? '1' : '0'}
          </span>
        ) : verdict === 'wrong' ? (
          <span className="text-red-500">再想想，还剩 {MAX_ATTEMPTS - attempts} 次机会</span>
        ) : (
          <span className="text-muted-foreground">还剩 {MAX_ATTEMPTS - attempts} 次机会</span>
        )}
      </div>
    </div>
  );
}
