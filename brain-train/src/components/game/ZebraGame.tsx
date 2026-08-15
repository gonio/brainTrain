// 左邻右舍：N 座房子排一排，每座住一人、养一宠物、喝一饮料，互不重复。
// 给若干条全部成立的线索（解唯一），玩家推理后回答「谁养X / 谁喝X /
// 第 k 座养什么或喝什么」。单题渲染器：由 LogicSessionShell 驱动
// （每题 3 次机会，答对或机会用完时上抛一次结果）。
import { useMemo, useState } from 'react';
import { generateZebraPuzzle } from '../../lib/logic/zebraEngine';
import { makeClueText, expectedZebraAnswer } from '../../lib/logic/zebraText';
import { MAX_ATTEMPTS } from '../../lib/logic/attempts';
import { useAudio } from '../../hooks/useAudio';
import type { LogicRoundProps } from './LogicSessionShell';

type Verdict = 'correct' | 'wrong' | null;

export function ZebraGame({ engineLevel, isActive, rng, onRoundEnd }: LogicRoundProps) {
  const { playEffect } = useAudio();
  // 同一次挂载内题目固定：rng 只在首次渲染消费一次
  const puzzle = useMemo(() => generateZebraPuzzle(engineLevel, rng), [engineLevel, rng]);
  const [attempts, setAttempts] = useState(0); // 已用作答次数
  const [verdict, setVerdict] = useState<Verdict>(null); // 最后一次作答对错
  const [ended, setEnded] = useState(false); // 本题已结算（忽略后续点击）

  const { houses, people, pets, drinks, clues, question } = puzzle;
  const clueText = makeClueText(puzzle);
  const expected = expectedZebraAnswer(puzzle);
  // whoHasPet/whoDrinks → 人名 chips；whatAtHouse → 按 attr 出宠物或饮料 chips
  const options: string[] =
    question.kind === 'whatAtHouse' ? (question.attr === 'pet' ? pets : drinks) : people;
  const questionText =
    question.kind === 'whoHasPet'
      ? `谁养${question.pet}？`
      : question.kind === 'whoDrinks'
        ? `谁喝${question.drink}？`
        : `第 ${question.house} 座${question.attr === 'pet' ? '养什么' : '喝什么'}？`;

  // 点一个选项即一次作答：与 expectedZebraAnswer 比对
  const handlePick = (pick: string) => {
    if (ended || !isActive) return;
    const used = attempts + 1;
    // 音效归属约定：终结音效（答对/机会用完）由 LogicSessionShell 播，组件只在非终结答错时播 wrong
    if (pick === expected) {
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
        {houses} 座房子排一排（1 号在最左），每座住一人、养一宠物、喝一饮料，互不重复。
      </p>

      {/* 属性栏：人 / 宠物 / 饮料各一行 chips */}
      <div className="w-full p-4 bg-surface rounded-2xl border border-border space-y-2">
        {(
          [
            ['人', people],
            ['宠物', pets],
            ['饮料', drinks],
          ] as const
        ).map(([label, items]) => (
          <div key={label} className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground w-8 shrink-0">{label}</span>
            {items.map((it) => (
              <span key={it} className="px-2.5 py-1 rounded-lg bg-accent/60 text-sm text-foreground">
                {it}
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* 线索列表 */}
      <ul className="w-full p-4 bg-surface rounded-2xl border border-border space-y-2">
        {clues.map((c, i) => (
          <li key={i} className="text-foreground leading-relaxed">
            {`${i + 1}. ${clueText(c)}`}
          </li>
        ))}
      </ul>

      {/* 问题 + 选项 chips；结束后揭示期望答案 */}
      <div className="w-full p-4 bg-surface rounded-2xl border border-border space-y-3">
        <p className="font-headline font-bold text-foreground text-center">{questionText}</p>
        {ended ? (
          <div className="flex justify-center">
            <span className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-bold">
              {`答案：${expected}`}
            </span>
          </div>
        ) : (
          <div className="flex justify-center gap-2 flex-wrap">
            {options.map((opt) => (
              <button
                key={opt}
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
            {verdict === 'correct' ? '答对了！' : '机会用完，看看上面的正确答案'}
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
