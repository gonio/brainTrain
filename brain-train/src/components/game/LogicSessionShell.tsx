// 逻辑谜题自由练习会话外壳（尝试次数制，见 CONTEXT.md）：
// 6 个逻辑游戏共用的会话流程：开始屏（自动弹规则）→ 三档难度 → 3 秒倒计时
// → 5 题循环（每题独立随机引擎难度、3 次机会）→ 结算（得分/首对率/逐题星级）→ 再玩一次。
// 各游戏只提供「单题渲染器」renderRound，外壳负责会话状态机与计分。
// 流程参照 src/pages/games/Sequence.tsx（难度按钮照其内联 DifficultySelector 样式）。
import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useAudio } from '../../hooks/useAudio';
import { GameStartScreen } from './GameStartScreen';
import { GameControlBar } from './GameControlBar';
import { ScoreBoard } from './ScoreBoard';
import { useStartCountdown } from '../../hooks/useStartCountdown';
import {
  starsForAttempts,
  logicSessionScore,
  firstTryAccuracy,
} from '../../lib/logic/attempts';
import type { LogicRoundOutcome } from '../../lib/logic/attempts';
import type { TrainingMode, LogicGameId, LogicPuzzleDetails } from '../../types';

/** 外壳传给单题渲染器的 props：引擎难度 + 激活态 + 结果上抛回调 */
export interface LogicRoundProps {
  engineLevel: number;
  isActive: boolean;
  rng?: () => number;
  /** 每题只允许调用一次（答对或机会用完时）。重复调用会被外壳忽略。 */
  onRoundEnd: (o: LogicRoundOutcome) => void;
}

export interface LogicSessionShellProps {
  mode: TrainingMode; // 逻辑游戏 id
  title: string;
  description: string;
  engineLevels: Record<'easy' | 'medium' | 'hard', readonly [number, number]>; // 每档引擎难度闭区间
  renderRound: (props: LogicRoundProps) => ReactNode;
}

type Difficulty = 'easy' | 'medium' | 'hard';

const ROUNDS_PER_SESSION = 5;
// 题与题之间留 500ms 间隔，让玩家看到对错反馈再进下一题
const ROUND_ADVANCE_MS = 500;

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

/** 闭区间 [min, max] 内随机整数（每题独立抽引擎难度） */
function randomLevel([min, max]: readonly [number, number]): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function LogicSessionShell({
  mode,
  title,
  description,
  engineLevels,
  renderRound,
}: LogicSessionShellProps) {
  const { startGame, endGame, status } = useGameStore();
  const { playEffect } = useAudio();

  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [roundIdx, setRoundIdx] = useState(0);
  const [roundLevels, setRoundLevels] = useState<number[]>([]);
  const [outcomes, setOutcomes] = useState<LogicRoundOutcome[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [finalAccuracy, setFinalAccuracy] = useState(0);
  // 题间 500ms 定时器，卸载时清理
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // onRoundEnd 单次上抛防护：当前题结算后置 true，换题时归零
  const roundSettledRef = useRef(false);
  // 开局 3 秒倒计时缓冲：结束后才真正 startGame（不计入游戏用时）
  const { overlay: countdownOverlay, trigger: triggerCountdown } = useStartCountdown();

  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const isIdle = status === 'idle';

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  // 换题（key 重挂载新题）后重置单次上抛防护
  useEffect(() => {
    roundSettledRef.current = false;
  }, [roundIdx]);

  // 真正开局：倒计时结束后抽 5 题引擎难度、清空进度、startGame
  const handleStart = useCallback(() => {
    triggerCountdown(() => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      setRoundLevels(
        Array.from({ length: ROUNDS_PER_SESSION }, () => randomLevel(engineLevels[difficulty])),
      );
      setOutcomes([]);
      setRoundIdx(0);
      setShowResult(false);
      setFinalScore(0);
      setFinalAccuracy(0);
      startGame(mode);
    });
  }, [triggerCountdown, engineLevels, difficulty, startGame, mode]);

  // 单题结束：记录结果、播对错音效；未够 5 题则 500ms 后自动进下一题，够 5 题则结算
  const handleRoundEnd = useCallback(
    (outcome: LogicRoundOutcome) => {
      // 单题单次上抛契约：已结算（含 500ms 换题窗口内）的重复调用直接忽略
      if (roundSettledRef.current) return;
      roundSettledRef.current = true;
      playEffect(outcome.correct ? 'correct' : 'wrong');
      const next = [...outcomes, outcome];
      setOutcomes(next);

      if (next.length < ROUNDS_PER_SESSION) {
        advanceTimerRef.current = setTimeout(() => setRoundIdx((i) => i + 1), ROUND_ADVANCE_MS);
        return;
      }

      // 5 题齐：答对按第几次答对评星，答错 0 星；会话分=星数占比，准确率=首对率
      const stars = next.map((o) => (o.correct ? starsForAttempts(o.attempts) : 0));
      const score = logicSessionScore(stars);
      const accuracy = firstTryAccuracy(next);
      const details: LogicPuzzleDetails = {
        game: mode as LogicGameId,
        engineLevel: Math.max(...roundLevels),
        rounds: next,
      };

      setFinalScore(score);
      setFinalAccuracy(accuracy);
      setShowResult(true);
      playEffect('complete');
      void endGame({ score, accuracy, details });
    },
    [outcomes, roundLevels, mode, endGame, playEffect],
  );

  return (
    <>
      {/* GameControlBar 依赖 app 的 data-router 上下文，仅在游戏中挂载
         （其内部本就在 idle/completed 时返回 null，视觉行为与 Sequence 一致） */}
      {(isPlaying || isPaused) && <GameControlBar title={title} />}
      <div className="max-w-2xl mx-auto px-6 pt-4 pb-32 flex flex-col" style={{ minHeight: 'calc(100vh - 140px)' }}>
        {/* 游戏开始页面 */}
        {isIdle && !showResult && (
          <GameStartScreen
            mode={mode}
            title={title}
            description={description}
            onStart={handleStart}
          />
        )}

        {/* 难度选择（样式照 Sequence.tsx 内联 DifficultySelector；
            注意保持为内联 JSX 而非嵌套组件，否则切换选中态时按钮被重挂载） */}
        {!isPlaying && !showResult && (
          <div className="flex justify-center gap-2 mb-6">
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                disabled={isPlaying}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${difficulty === d
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-accent text-accent-foreground hover:bg-accent/80'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {DIFFICULTY_LABELS[d]}
              </button>
            ))}
          </div>
        )}

        {/* 单题渲染区：key 重挂载保证每题是干净状态；暂停时不卸载
            （仅 isActive 变 false，照 Sequence.tsx），保住题内状态 */}
        {(isPlaying || isPaused) && roundLevels.length === ROUNDS_PER_SESSION && (
          <div className="flex-1 flex flex-col justify-start py-2 mb-4">
            <div className="text-center text-sm text-muted-foreground mb-2">
              第 {roundIdx + 1}/{ROUNDS_PER_SESSION} 题
            </div>
            <div key={roundIdx}>
              {renderRound({
                engineLevel: roundLevels[roundIdx],
                isActive: isPlaying && !showResult,
                onRoundEnd: handleRoundEnd,
              })}
            </div>
          </div>
        )}

        {/* 控制按钮 */}
        <div className="flex justify-center gap-4">
          {showResult && (
            <motion.button
              onClick={handleStart}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-lg"
            >
              再玩一次
            </motion.button>
          )}
        </div>

        {/* 结果展示 */}
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 p-6 bg-surface-container-low rounded-2xl border border-border"
          >
            <h3 className="text-lg font-semibold mb-4 text-center font-headline">训练完成！</h3>
            <ScoreBoard score={finalScore} accuracy={finalAccuracy} />

            {/* 逐题星级：答对按第几次答对评星（3/2/1），答错 ✗ */}
            <div className="mt-6 flex justify-center gap-3">
              {outcomes.map((o, index) => (
                <div key={index} className="text-center p-3 bg-accent/50 rounded-xl min-w-12">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    第{index + 1}题
                  </div>
                  <div className="text-lg font-bold text-primary">
                    {o.correct ? '★'.repeat(starsForAttempts(o.attempts)) : '✗'}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* 开局倒计时遮罩 */}
      {countdownOverlay}
    </>
  );
}
