// 找谬误：读一段材料，选出含谬误的那句话，再判断它属于 8 种谬误类型中的哪一种。
// 定位 + 分类两步全对才算答对；答错只提示哪一步错了（定位/类型），不揭示答案。
// 单题渲染器：由 LogicSessionShell 驱动（每题 3 次机会，答对或机会用完时上抛一次结果）。
import { useMemo, useState } from 'react';
import { FALLACY_TYPES, judgeFallacy } from '../../lib/logic/fallacyEngine';
import { pickFallacyQuestion } from '../../lib/logic/fallacyBank';
import { MAX_ATTEMPTS } from '../../lib/logic/attempts';
import { useAudio } from '../../hooks/useAudio';
import type { LogicRoundProps } from './LogicSessionShell';

type Verdict = 'correct' | 'wrong' | null;

export function FallacyGame({ engineLevel, isActive, rng, onRoundEnd }: LogicRoundProps) {
  const { playEffect } = useAudio();
  // 同一次挂载内题目固定：rng 只在首次渲染消费一次；engineLevel 即题库难度 1/2/3
  const question = useMemo(
    () => pickFallacyQuestion(engineLevel as 1 | 2 | 3, rng),
    [engineLevel, rng],
  );
  const [pickedSentenceId, setPickedSentenceId] = useState<number | null>(null);
  const [pickedType, setPickedType] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0); // 已用作答次数
  const [verdict, setVerdict] = useState<Verdict>(null); // 最后一次作答对错
  const [feedback, setFeedback] = useState<string | null>(null); // 哪一步错了（不揭示答案）
  const [ended, setEnded] = useState(false); // 本题已结算（忽略后续点击）

  const correctSentence = question.material.find((s) => s.isFallacy)!;

  // 提交即一次作答：judgeFallacy 判定，两步全对才算对
  const handleSubmit = () => {
    if (ended || !isActive || pickedSentenceId === null || pickedType === null) return;
    const used = attempts + 1;
    const result = judgeFallacy(question, pickedSentenceId, pickedType);
    if (result.locatedCorrectly && result.classifiedCorrectly) {
      setVerdict('correct');
      setEnded(true);
      onRoundEnd({ correct: true, attempts: used });
      return;
    }
    setVerdict('wrong');
    if (used >= MAX_ATTEMPTS) {
      setFeedback(null);
      setEnded(true);
      onRoundEnd({ correct: false, attempts: MAX_ATTEMPTS });
      return;
    }
    // 只提示哪一步错了，不揭示具体答案，否则同一题 3 次机会形同虚设
    const wrongSteps: string[] = [];
    if (!result.locatedCorrectly) wrongSteps.push('定位不对');
    if (pickedType !== question.fallacyType) wrongSteps.push('类型不对');
    setFeedback(wrongSteps.join('，'));
    // 音效归属约定：终结音效（答对/机会用完）由 LogicSessionShell 播，组件只在非终结答错时播 wrong
    playEffect('wrong');
    setAttempts(used);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="font-headline font-bold text-foreground text-center">{question.title}</p>
      <p className="text-sm text-muted-foreground text-center">
        选出含有谬误的那句话，再判断它属于哪种谬误类型。
      </p>

      {/* 材料：每句一张可点卡片，选中高亮；结束后揭示正确句子 */}
      <div className="w-full p-4 bg-surface rounded-2xl border border-border space-y-2">
        {question.material.map((s) => (
          <button
            key={s.id}
            onClick={() => setPickedSentenceId(s.id)}
            disabled={ended || !isActive}
            className={`w-full text-left px-3 py-2 rounded-lg bg-accent/40 text-foreground leading-relaxed transition-all disabled:cursor-default ${
              pickedSentenceId === s.id || (ended && s.isFallacy) ? 'ring-2 ring-primary' : ''
            }`}
          >
            {s.text}
          </button>
        ))}
      </div>

      {/* 谬误类型 8 chips 网格 */}
      <div className="w-full p-4 bg-surface rounded-2xl border border-border">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {FALLACY_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setPickedType(t)}
              disabled={ended || !isActive}
              className={`px-3 py-2 rounded-lg text-sm font-medium bg-accent/40 text-foreground transition-all disabled:cursor-default ${
                pickedType === t ? 'ring-2 ring-primary' : ''
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 提交：句子与类型都选后才可点 */}
      {!ended && (
        <button
          onClick={handleSubmit}
          disabled={!isActive || pickedSentenceId === null || pickedType === null}
          className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          提交答案
        </button>
      )}

      {/* 结束后揭示：正确句子 + 谬误类型 + 解析 */}
      {ended && (
        <div className="w-full p-4 bg-surface rounded-2xl border border-border space-y-2">
          <p className="text-foreground leading-relaxed">正确句子：{correctSentence.text}</p>
          <p className="text-foreground">谬误类型：{question.fallacyType}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            解析：{question.explanation}
          </p>
        </div>
      )}

      {/* 剩余机会 / 作答反馈 */}
      <div className="h-6 text-sm text-center">
        {ended ? (
          <span
            className={verdict === 'correct' ? 'text-primary font-bold' : 'text-red-500 font-bold'}
          >
            {verdict === 'correct' ? '答对了！' : '机会用完，看看上面的解析'}
          </span>
        ) : verdict === 'wrong' ? (
          <span className="text-red-500">
            {feedback}，再想想，还剩 {MAX_ATTEMPTS - attempts} 次机会
          </span>
        ) : (
          <span className="text-muted-foreground">还剩 {MAX_ATTEMPTS - attempts} 次机会</span>
        )}
      </div>
    </div>
  );
}
