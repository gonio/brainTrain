// 说得通吗：判断三段论的「推理形式」是否有效（与结论内容真假无关）。
// 单题渲染器：由 LogicSessionShell 驱动（每题 3 次机会，答对或机会用完时上抛一次结果）。
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { generateSyllogismPuzzle } from '../../lib/logic/syllogismEngine';
import { MAX_ATTEMPTS } from '../../lib/logic/attempts';
import { useAudio } from '../../hooks/useAudio';
import type { LogicRoundProps } from './LogicSessionShell';

type Verdict = 'correct' | 'wrong' | null;

export function SyllogismGame({ engineLevel, isActive, rng, onRoundEnd }: LogicRoundProps) {
  const { playEffect } = useAudio();
  // 同一次挂载内题目固定：rng 只在首次渲染消费一次
  const puzzle = useMemo(() => generateSyllogismPuzzle(engineLevel, rng), [engineLevel, rng]);
  const [attempts, setAttempts] = useState(0); // 已用作答次数
  const [verdict, setVerdict] = useState<Verdict>(null); // 最后一次作答对错
  const [ended, setEnded] = useState(false); // 本题已结算（忽略后续点击）
  const [lastPick, setLastPick] = useState<boolean | null>(null); // 最后一次点的是哪个按钮（标红用）

  const handlePick = (choice: boolean) => {
    if (ended || !isActive) return;
    setLastPick(choice);
    const used = attempts + 1;
    // 音效归属约定：终结音效（答对/机会用完）由 LogicSessionShell 播，组件只在非终结答错时播 wrong
    if (choice === puzzle.valid) {
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
      'flex-1 py-3 rounded-xl font-headline font-bold border transition-all disabled:cursor-default';
    if (verdict === null || (verdict === 'wrong' && choice !== lastPick)) {
      return `${base} bg-surface border-border hover:bg-accent/60`;
    }
    if (choice === puzzle.valid && ended) return `${base} bg-primary text-primary-foreground border-primary`;
    if (choice === lastPick && verdict === 'wrong') return `${base} bg-red-500/20 border-red-500/40`;
    return `${base} bg-surface border-border`;
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* 题干卡：两句前提 + 一句结论（前提合并为一行，保证标签文本唯一） */}
      <div className="w-full p-6 bg-surface rounded-2xl border border-border space-y-3">
        <p className="text-foreground leading-relaxed">
          <span className="font-headline font-bold">前提：</span>
          {puzzle.premises[0]}；{puzzle.premises[1]}
        </p>
        <p className="text-foreground leading-relaxed">
          <span className="font-headline font-bold">结论：</span>
          {puzzle.conclusion}
        </p>
      </div>

      <p className="text-sm text-muted-foreground text-center">
        只看推理形式是否有效，别被内容真假带偏。
      </p>

      {/* 两个判断按钮 */}
      <div className="w-full flex gap-4">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => handlePick(true)}
          disabled={ended || !isActive}
          className={buttonClass(true)}
        >
          说得通
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => handlePick(false)}
          disabled={ended || !isActive}
          className={buttonClass(false)}
        >
          说不通
        </motion.button>
      </div>

      {/* 剩余机会 / 作答反馈 / 谜底 */}
      <div className="h-6 text-sm text-center">
        {ended ? (
          <span className={verdict === 'correct' ? 'text-primary font-bold' : 'text-red-500 font-bold'}>
            这段推理其实{puzzle.valid ? '说得通' : '说不通'}
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
