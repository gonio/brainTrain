// 排排坐：N 个人排成一列，给若干条全部成立的线索，玩家推理排位后回答
// 「第 k 位是谁」或「某人在第几位」。单题渲染器：由 LogicSessionShell 驱动
// （每题 3 次机会，答对或机会用完时上抛一次结果）。
import { useMemo, useState } from 'react';
import { generateLineupPuzzle } from '../../lib/logic/lineupEngine';
import { clueText } from '../../lib/logic/lineupText';
import { MAX_ATTEMPTS } from '../../lib/logic/attempts';
import { useAudio } from '../../hooks/useAudio';
import type { LogicRoundProps } from './LogicSessionShell';

type Verdict = 'correct' | 'wrong' | null;

export function LineupGame({ engineLevel, isActive, rng, onRoundEnd }: LogicRoundProps) {
  const { playEffect } = useAudio();
  // 同一次挂载内题目固定：rng 只在首次渲染消费一次
  const puzzle = useMemo(() => generateLineupPuzzle(engineLevel, rng), [engineLevel, rng]);
  const [attempts, setAttempts] = useState(0); // 已用作答次数
  const [verdict, setVerdict] = useState<Verdict>(null); // 最后一次作答对错
  const [ended, setEnded] = useState(false); // 本题已结算（忽略后续点击）

  const { people, clues, solution, question } = puzzle;
  // whoAt → 选项为人名 chips；whereIs → 选项为位置号 1..N chips
  const options: (string | number)[] =
    question.kind === 'whoAt' ? people : people.map((_, i) => i + 1);
  const questionText =
    question.kind === 'whoAt'
      ? `第 ${question.pos} 位是谁？`
      : `${people[question.person]} 在第几位？`;

  // 点一个选项即一次作答。判定：whoAt → 选中名字 === 第 pos 位的人；
  // whereIs → 选中数字 === person 所在位置（solution[posIdx] = personId，0 基）
  const handlePick = (pick: string | number) => {
    if (ended || !isActive) return;
    const used = attempts + 1;
    const correct =
      question.kind === 'whoAt'
        ? pick === people[solution[question.pos - 1]]
        : pick === solution.indexOf(question.person) + 1;
    // 音效归属约定：终结音效（答对/机会用完）由 LogicSessionShell 播，组件只在非终结答错时播 wrong
    if (correct) {
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

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground text-center">
        {people.length} 个人排成一列，以下线索全部成立。
      </p>

      {/* 线索列表 */}
      <ul className="w-full p-4 bg-surface rounded-2xl border border-border space-y-2">
        {clues.map((c, i) => (
          <li key={i} className="text-foreground leading-relaxed">
            {`${i + 1}. ${clueText(c, people)}`}
          </li>
        ))}
      </ul>

      {/* 问题 + 选项 chips；结束后揭示正确排位 */}
      <div className="w-full p-4 bg-surface rounded-2xl border border-border space-y-3">
        <p className="font-headline font-bold text-foreground text-center">{questionText}</p>
        {ended ? (
          <div className="flex justify-center gap-2 flex-wrap">
            {solution.map((pid, i) => (
              <span
                key={i}
                className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-bold"
              >
                {`${i + 1}. ${people[pid]}`}
              </span>
            ))}
          </div>
        ) : (
          <div className="flex justify-center gap-2 flex-wrap">
            {options.map((opt) => (
              <button
                key={String(opt)}
                onClick={() => handlePick(opt)}
                disabled={ended || !isActive}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-surface border border-border hover:bg-accent/60 transition-all disabled:cursor-default"
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 剩余机会 / 作答反馈 */}
      <div className="h-6 text-sm text-center">
        {ended ? (
          <span
            className={verdict === 'correct' ? 'text-primary font-bold' : 'text-red-500 font-bold'}
          >
            {verdict === 'correct' ? '答对了！' : '机会用完，看看上面的正确排位'}
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
