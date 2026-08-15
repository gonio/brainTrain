// 真假岛：岛上每人非骑士（永说真话）即无赖（永说谎话），各留一句陈述，
// 玩家给每个人定身份。单题渲染器：由 LogicSessionShell 驱动
// （每题 3 次机会，答对或机会用完时上抛一次结果）。
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { generateTruthPuzzle } from '../../lib/logic/truthEngine';
import { statementText } from '../../lib/logic/truthText';
import { MAX_ATTEMPTS } from '../../lib/logic/attempts';
import { useAudio } from '../../hooks/useAudio';
import type { LogicRoundProps } from './LogicSessionShell';

type Verdict = 'correct' | 'wrong' | null;

// 玩家答案与谜底逐元素比较（等长布尔数组）
function arraysEqual(a: boolean[], b: boolean[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function TruthGame({ engineLevel, isActive, rng, onRoundEnd }: LogicRoundProps) {
  const { playEffect } = useAudio();
  // 同一次挂载内题目固定：rng 只在首次渲染消费一次
  const puzzle = useMemo(() => generateTruthPuzzle(engineLevel, rng), [engineLevel, rng]);
  // 玩家判定的身份（true=骑士 / false=无赖 / null=未选）。
  // 初始全部未选：必须逐人显式选择后才能提交，
  // 否则谜底恰为全骑士的题会被盲点「提交答案」直接白嫖 3 星。
  const [guesses, setGuesses] = useState<(boolean | null)[]>(() =>
    Array(puzzle.statements.length).fill(null),
  );
  const [attempts, setAttempts] = useState(0); // 已用作答次数
  const [verdict, setVerdict] = useState<Verdict>(null); // 最后一次作答对错
  const [ended, setEnded] = useState(false); // 本题已结算（忽略后续点击）

  const setIdentity = (i: number, value: boolean) => {
    if (ended || !isActive) return;
    setGuesses((prev) => prev.map((x, j) => (j === i ? value : x)));
  };

  const handleSubmit = () => {
    if (ended || !isActive) return;
    // 有人未判定不允许提交（按钮已禁用，此处双保险）
    if (guesses.some((g) => g === null)) return;
    const used = attempts + 1;
    // 音效归属约定：终结音效（答对/机会用完）由调用方（LogicSessionShell / QuestLogicRunner）播，
    // 组件只在非终结答错时播 wrong
    if (arraysEqual(guesses as boolean[], puzzle.knight)) {
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

  // 身份切换按钮：选中态 bg-primary
  const toggleClass = (selected: boolean) =>
    `flex-1 py-2 rounded-lg text-sm font-medium border transition-all disabled:cursor-default ${
      selected
        ? 'bg-primary text-primary-foreground border-primary'
        : 'bg-surface border-border hover:bg-accent/60'
    }`;

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground text-center">
        骑士永远说真话，无赖永远说谎话。判断每个人的身份。
      </p>

      {/* 每人一张卡：陈述 + 骑士/无赖 二选一切换；结束后揭示真实身份 */}
      {puzzle.statements.map((s, i) => (
        <div key={i} className="w-full p-4 bg-surface rounded-2xl border border-border space-y-3">
          <p className="text-foreground leading-relaxed">
            <span className="font-headline font-bold">第 {i + 1} 人：</span>
            「{statementText(s)}」
          </p>
          {ended ? (
            <p
              className={`text-sm font-headline font-bold ${
                puzzle.knight[i] ? 'text-primary' : 'text-red-500'
              }`}
            >
              第 {i + 1} 人：{puzzle.knight[i] ? '骑士' : '无赖'}
            </p>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setIdentity(i, true)}
                disabled={ended || !isActive}
                className={toggleClass(guesses[i] === true)}
              >
                骑士
              </button>
              <button
                onClick={() => setIdentity(i, false)}
                disabled={ended || !isActive}
                className={toggleClass(guesses[i] === false)}
              >
                无赖
              </button>
            </div>
          )}
        </div>
      ))}

      {/* 提交按钮（全宽）：所有人身份都显式选定后才可点 */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSubmit}
        disabled={ended || !isActive || guesses.some((g) => g === null)}
        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-headline font-bold hover:bg-primary/90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-default"
      >
        提交答案
      </motion.button>

      {/* 剩余机会 / 作答反馈 */}
      <div className="h-6 text-sm text-center">
        {ended ? (
          <span
            className={verdict === 'correct' ? 'text-primary font-bold' : 'text-red-500 font-bold'}
          >
            {verdict === 'correct' ? '全对！' : '机会用完，看看上面的真实身份'}
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
