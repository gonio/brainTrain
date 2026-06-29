// 结算弹窗：星级动画 + 错题对比 + 继续下一关 / 返回大厅
import { motion } from 'framer-motion';
import { COLORS } from '@/components/game/StroopGame';
import type {
  QuestResult,
  GameId,
  SchulteQuestDetails,
  SequenceQuestDetails,
  StroopQuestDetails,
} from '@/types/quest';

// 颜色名 → CSS 颜色值映射，用于把错题题面渲染成和游戏里一样的样式
// （文字内容=字义，文字颜色=显示色），一眼就能看出"这个字是什么颜色"。
const COLOR_VALUE: Record<string, string> = Object.fromEntries(
  COLORS.map((c) => [c.name, c.value]),
);

const GAME_NAMES: Record<GameId, string> = {
  schulte: '舒尔特表',
  sequence: '序列记忆',
  stroop: '字色干扰',
  bottle: '暗瓶排列',
};

interface QuestResultDialogProps {
  result: QuestResult;
  isCleared: boolean;   // 是否全游戏通关
  onNext: () => void;   // 继续下一关
  onHub: () => void;    // 返回大厅
}

export function QuestResultDialog({ result, isCleared, onNext, onHub }: QuestResultDialogProps) {
  const failed = result.passed === false;

  return (
    <div className="max-w-md mx-auto text-center py-12">
      {isCleared && !failed && (
        <p className="text-2xl font-headline font-black text-success mb-2">🎉 主线全部通关！</p>
      )}
      <h2 className={`font-headline text-3xl font-extrabold mb-4 ${failed ? 'text-red-500' : 'text-foreground'}`}>
        {failed ? '挑战失败' : '关卡完成！'}
      </h2>

      {/* 星级动画（逐颗点亮）；失败时 3 颗灰星（stars=0） */}
      <div className="flex justify-center gap-2 mb-4">
        {[1, 2, 3].map((n) => (
          <motion.span
            key={n}
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: n * 0.2, type: 'spring' }}
            className={`text-5xl ${n <= result.stars ? 'text-yellow-400' : 'text-muted-foreground/30'}`}
          >
            ★
          </motion.span>
        ))}
      </div>

      <p className="text-muted-foreground mb-6">
        {GAME_NAMES[result.gameId]} · 难度 {result.difficulty}
      </p>

      {/* 错题对比：失败时同样展示明细，让玩家看到错在哪。 */}
      <div className="mb-8 text-left">
        {result.gameId === 'schulte' && (
          <SchulteCompare details={result.details as unknown as SchulteQuestDetails} />
        )}
        {result.gameId === 'sequence' && (
          <SequenceCompare details={result.details as unknown as SequenceQuestDetails} />
        )}
        {result.gameId === 'stroop' && (
          <StroopCompare details={result.details as unknown as StroopQuestDetails} />
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onHub}
          className="flex-1 py-3 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors font-bold"
        >
          返回大厅
        </button>
        {!isCleared && (
          <button
            onClick={onNext}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-bold"
          >
            {failed ? '再次挑战本关' : '继续下一关'}
          </button>
        )}
      </div>
    </div>
  );
}

/** 舒尔特表：汇总「错点 N 处」+ 可折叠逐条明细。明细默认收起。 */
function SchulteCompare({ details }: { details: SchulteQuestDetails }) {
  const errors = details.errors ?? [];
  const count = details.errorCount ?? errors.length;

  // 没错点就不展示这块
  if (count === 0) return null;

  return (
    <div className="rounded-xl bg-surface-container-low p-4">
      <p className="text-sm mb-3">
        <span className="font-bold text-red-500">错点 {count} 处</span>
      </p>

      <ul className="space-y-1.5 text-sm">
        {errors.map((e, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="text-red-500">点了 {e.clicked}</span>
            <span className="text-muted-foreground">应点</span>
            <span className="font-bold text-success">{e.expected}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 记忆序列：两行逐位对比，错位标 ✗。 */
function SequenceCompare({ details }: { details: SequenceQuestDetails }) {
  const correct = details.sequence ?? [];
  const user = details.userSequence ?? [];

  if (correct.length === 0) return null;

  return (
    <div className="rounded-xl bg-surface-container-low p-4">
      <p className="text-xs text-muted-foreground mb-2">逐位对比</p>
      <div className="space-y-1.5">
        <SequenceRow label="正确" items={correct} correct={correct} />
        <SequenceRow label="你的" items={user} correct={correct} />
      </div>
    </div>
  );
}

function SequenceRow({
  label,
  items,
  correct,
}: {
  label: string;
  items: string[];
  correct: string[];
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground w-8 shrink-0">{label}</span>
      {items.map((item, i) => {
        const mismatch = item !== correct[i];
        return (
          <span
            key={i}
            data-mismatch={mismatch ? 'true' : 'false'}
            className={`w-8 h-8 inline-flex items-center justify-center text-xl rounded-lg ${
              mismatch
                ? 'bg-red-500/20 ring-1 ring-red-500/50'
                : 'bg-surface-container'
            }`}
          >
            {item}
          </span>
        );
      })}
    </div>
  );
}

/** 字色干扰：逐题列出全部错题，每题标明本题规则（选颜色/选字义）。
 *  dual 模式每题规则随机，不标规则用户无法理解为什么这个答案对/错。 */
function StroopCompare({ details }: { details: StroopQuestDetails }) {
  const errors = details.errors ?? [];
  const wrongCount = errors.length;

  if (wrongCount === 0) {
    return (
      <div className="rounded-xl bg-surface-container-low p-4">
        <p className="text-sm text-success font-bold">全部答对，无错题 🎯</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface-container-low p-4">
      <p className="text-sm mb-1">
        <span className="font-bold text-red-500">错 {wrongCount} 题</span>
      </p>
      <p className="text-xs text-muted-foreground mb-3">
        每题要求不同：<span className="text-primary font-bold">选颜色</span>＝按字的显示色选 ·
        <span className="text-orange-600 font-bold">选字义</span>＝按字本身含义选
      </p>
      <ul className="space-y-2.5 text-sm">
        {errors.map((e, i) => {
          // 本题要求：standard=选颜色 / reverse=选字义
          const pickColor = e.rule === 'standard';
          const ruleLabel = pickColor ? '选颜色' : '选字义';
          return (
            <li key={i} className="border-l-2 border-border pl-3">
              <div className="flex items-center gap-2 mb-1.5">
                {/* 题面：按游戏里原样呈现——文字内容是字义，文字颜色是显示色。
                    比如字义"红色"涂成蓝色，这里就是蓝色的"红色"二字，和题目里看到的一模一样。 */}
                <span
                  data-role="stroop-word"
                  className="text-lg font-black font-headline tracking-wider leading-none"
                  style={{ color: COLOR_VALUE[e.wordColor] ?? undefined }}
                >
                  {e.word}
                </span>
                {/* 规则标注：选颜色=蓝、选字义=橙，与游戏内一致 */}
                <span
                  className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded ${
                    pickColor ? 'bg-primary/15 text-primary' : 'bg-orange-500/15 text-orange-600'
                  }`}
                >
                  要求{ruleLabel}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <span className="text-red-500 text-xs">你选：{e.userAnswer || '（超时未选）'}</span>
                <span className="text-success font-bold text-xs">正确：{e.correctAnswer}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
