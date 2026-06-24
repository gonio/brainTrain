import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAudio } from '../../hooks/useAudio';
import { SchulteGrid } from '../../components/game/SchulteGrid';
import { ScoreBoard } from '../../components/game/ScoreBoard';
import { GameControlBar } from '../../components/game/GameControlBar';
import { GameStartScreen } from '../../components/game/GameStartScreen';
import { QuestLevelIntro, QuestHUD, QuestResultDialog } from '../../components/game';
import {
  getLevelConfig,
  computeStars,
  computeScore,
  generateMixedSequence,
} from '../../lib/schulteQuestConfig';
import { getQuestProgress, saveQuestProgress, createInitialProgress } from '../../db/queries';
import type { TrainingDetails, SchulteQuestProgress } from '../../types';

// 固定5x5配置
const GRID_SIZE = 5;
const GRID_ORDER = 'asc' as const;

function SchulteFree({ onExit }: { onExit: () => void }) {
  const { startGame, endGame, status } = useGameStore();
  const { soundEnabled } = useSettingsStore();
  const { playEffect } = useAudio();

  const [gameStartTime, setGameStartTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [errors, setErrors] = useState(0);
  const [clickSequence, setClickSequence] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const isIdle = status === 'idle';

  // Timer update
  useEffect(() => {
    if (!isPlaying || gameStartTime === 0) return;

    const interval = setInterval(() => {
      setElapsedTime((Date.now() - gameStartTime) / 1000);
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, gameStartTime]);

  const handleStart = useCallback(() => {
    startGame('schulte');
    setGameStartTime(Date.now());
    setElapsedTime(0);
    setErrors(0);
    setClickSequence([]);
    setShowResult(false);
    setFinalScore(0);
  }, [startGame]);

  const handleCorrectClick = useCallback((_number: number, _time: number) => {
    setClickSequence(prev => [...prev, _number]);
    if (soundEnabled) {
      playEffect('tick');
    }
  }, [soundEnabled, playEffect]);

  const handleWrongClick = useCallback(() => {
    setErrors(prev => prev + 1);
    if (soundEnabled) {
      playEffect('wrong');
    }
  }, [soundEnabled, playEffect]);

  // 此函数由 SchulteGrid 组件在游戏完成时调用
  const handleComplete = useCallback(() => {
    const endTime = Date.now();
    const totalTime = (endTime - gameStartTime) / 1000;

    // 0-100 分制：准确度 70% + 速度 30%
    const maxNumber = GRID_SIZE * GRID_SIZE;
    const accuracyScore = ((maxNumber - errors) / maxNumber) * 100;
    const speedScore = Math.max(0, 100 - (totalTime - 20) * 2);
    const score = Math.min(100, Math.round(accuracyScore * 0.7 + speedScore * 0.3));

    const accuracy = Math.round(((maxNumber - errors) / maxNumber) * 100);

    const details: TrainingDetails = {
      mode: 'free' as const,
      gridSize: GRID_SIZE,
      order: GRID_ORDER,
      completionTime: totalTime,
      errorCount: errors,
      clickSequence,
      maxCombo: 0,
    };

    endGame({
      score,
      accuracy,
      details
    });

    setFinalScore(score);
    setShowResult(true);

    if (soundEnabled) {
      playEffect('complete');
    }
  }, [gameStartTime, errors, clickSequence, endGame, soundEnabled, playEffect]);

  return (
    <>
      {/* 游戏控制栏 - 游戏进行中显示 */}
      <GameControlBar
        title="舒尔特表"
        showTimer={isPlaying}
        elapsedTime={Math.floor(elapsedTime)}
      />

      <div className="max-w-2xl mx-auto px-6 pt-4 pb-32 flex flex-col" style={{ minHeight: 'calc(100vh - 140px)' }}>
        {/* 游戏开始页面 */}
        {isIdle && !showResult && (
          <GameStartScreen
            mode="schulte"
            title="舒尔特表"
            description="按顺序点击数字1-25，训练视觉搜索能力"
            onStart={handleStart}
          />
        )}

        {/* Game Grid - 占据剩余空间 */}
        <div className="flex-1 flex flex-col justify-start py-4">
          <SchulteGrid
            gridSize={GRID_SIZE}
            order={GRID_ORDER}
            onCorrectClick={handleCorrectClick}
            onWrongClick={handleWrongClick}
            onComplete={handleComplete}
            isActive={isPlaying}
            startTime={gameStartTime}
          />
        </div>

        {/* Metrics - Target, Accuracy, Avg Speed */}
        {(isPlaying || isPaused) && (
          <div className="mb-8 flex justify-center gap-12">
            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">目标</span>
              <span className="text-secondary text-2xl font-bold font-headline">
                {String(clickSequence.length + 1).padStart(2, '0')}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">准确率</span>
              <span className="text-foreground text-2xl font-bold font-headline">
                {clickSequence.length > 0
                  ? Math.round((clickSequence.length / (clickSequence.length + errors)) * 100)
                  : 100}%
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">错误</span>
              <span className="text-foreground text-2xl font-bold font-headline">{errors}</span>
            </div>
          </div>
        )}

        {/* Controls */}
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

        {/* Result Modal */}
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 p-6 bg-surface-container-low rounded-2xl border border-border"
          >
            <h3 className="text-lg font-semibold mb-4 text-center font-headline">训练完成！</h3>
            <ScoreBoard
              score={finalScore}
              accuracy={Math.round(((GRID_SIZE * GRID_SIZE - errors) / (GRID_SIZE * GRID_SIZE)) * 100)}
            />
            <div className="mt-4 text-center text-sm text-muted-foreground space-y-1">
              <p>用时: {elapsedTime.toFixed(2)}秒</p>
              <p>错误: {errors}</p>
            </div>
          </motion.div>
        )}

        {/* 返回模式选择 - 仅在 idle 且未显示结果时显示 */}
        {isIdle && !showResult && (
          <button
            onClick={onExit}
            className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← 返回模式选择
          </button>
        )}
      </div>
    </>
  );
}

type Mode = 'free' | 'quest' | null;

export function Schulte() {
  const [mode, setMode] = useState<Mode>(null);
  const [progress, setProgress] = useState<SchulteQuestProgress | null>(null);
  const [showEntryDialog, setShowEntryDialog] = useState(false);

  // 入口页（mode === null）挂载或重入时刷新进度
  // 避免从 quest/free 退出回入口时副标题仍显示旧值
  useEffect(() => {
    if (mode !== null) return;
    getQuestProgress().then(setProgress);
  }, [mode]);

  const handleQuestClick = async () => {
    // 异步读取 DB 进度，避免在 progress 仍为 null 时用 createInitialProgress 兜底
    // 导致已有进度的玩家被误判为新玩家
    const p = progress ?? (await getQuestProgress());
    // 三种入口分支：
    //   全新玩家（无进度）→ 直接进入第 1 关，不显示弹窗
    //   其他（有 inProgressLevel、有已通关记录、已全通关）→ 显示弹窗让用户选
    if (!p.inProgressLevel && p.clearedLevel === 0) {
      setMode('quest');
    } else {
      setProgress(p);
      setShowEntryDialog(true);
    }
  };

  // 入口页：mode 选择
  if (mode === null) {
    return (
      <div className="max-w-md mx-auto px-6 pt-8 pb-32">
        <h1 className="font-headline text-3xl font-extrabold mb-6 text-center">舒尔特表</h1>
        <div className="space-y-3">
          <button
            onClick={() => setMode('free')}
            className="w-full p-5 bg-surface rounded-2xl editorial-shadow hover:bg-accent transition-all text-left"
          >
            <div className="font-bold text-base mb-1">自由练习</div>
            <div className="text-xs text-muted-foreground">5×5 网格 · 无压力</div>
          </button>
          <button
            onClick={handleQuestClick}
            className="w-full p-5 bg-surface rounded-2xl editorial-shadow hover:bg-accent transition-all text-left"
          >
            <div className="font-bold text-base mb-1">闯关模式</div>
            <div className="text-xs text-muted-foreground">
              {progress && (progress.clearedLevel > 0 || progress.inProgressLevel)
                ? `进度：第 ${progress.inProgressLevel ?? progress.clearedLevel + 1} 关 · ⭐ ${progress.totalStars}/30`
                : '10 关挑战 · 连击 + 星级'}
            </div>
          </button>
        </div>

        {showEntryDialog && progress && (
          <EntryDialog
            progress={progress}
            onContinue={() => {
              setShowEntryDialog(false);
              setMode('quest');
            }}
            onRestart={async () => {
              const updated: SchulteQuestProgress = {
                ...progress,
                inProgressLevel: 1,
              };
              await saveQuestProgress(updated);
              setProgress(updated);
              setShowEntryDialog(false);
              setMode('quest');
            }}
          />
        )}
      </div>
    );
  }

  if (mode === 'free') {
    return <SchulteFree onExit={() => setMode(null)} />;
  }

  return <SchulteQuest initialProgress={progress} onExit={() => setMode(null)} />;
}

function EntryDialog({
  progress,
  onContinue,
  onRestart,
}: {
  progress: SchulteQuestProgress;
  onContinue: () => void;
  onRestart: () => void;
}) {
  const isCompleted = progress.clearedLevel === 10 && !progress.inProgressLevel;
  const continueLevel = progress.inProgressLevel ?? progress.clearedLevel + 1;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        {isCompleted ? (
          <>
            <h3 className="text-center text-xl font-extrabold mb-2">🏆 全部通关</h3>
            <p className="text-center text-sm text-muted-foreground mb-4">
              已通关全部 10 关 · ⭐ {progress.totalStars}/30
            </p>
          </>
        ) : (
          <>
            <h3 className="text-center text-xl font-extrabold mb-2">继续闯关</h3>
            <p className="text-center text-sm text-muted-foreground mb-4">
              当前进度：第 {continueLevel} 关 · ⭐ {progress.totalStars}/30
            </p>
          </>
        )}
        <div className="flex gap-3">
          {!isCompleted && (
            <button
              onClick={onContinue}
              className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold"
            >
              继续闯关
            </button>
          )}
          <button
            onClick={onRestart}
            className="flex-1 py-3 bg-accent text-foreground rounded-xl font-bold"
          >
            {isCompleted ? '重新挑战' : '重新闯关'}
          </button>
        </div>
      </div>
    </div>
  );
}

type QuestPhase = 'intro' | 'playing' | 'pass' | 'fail' | 'completed';

interface SchulteQuestProps {
  initialProgress: SchulteQuestProgress | null;
  onExit: () => void;
}

function SchulteQuest({ initialProgress, onExit }: SchulteQuestProps) {
  // 闯关模式音效：复用自由模式的 useAudio，遵循全局 soundEnabled 设置
  const { soundEnabled } = useSettingsStore();
  const { playEffect } = useAudio();

  // 当前关卡（继续时从 inProgressLevel，否则从 clearedLevel+1，再否则 1）
  const startLevel = initialProgress?.inProgressLevel
    ?? (initialProgress && initialProgress.clearedLevel < 10
        ? initialProgress.clearedLevel + 1
        : 1);
  const [currentLevel, setCurrentLevel] = useState(startLevel);

  const [phase, setPhase] = useState<QuestPhase>('intro');
  const [progress, setProgress] = useState<SchulteQuestProgress>(
    initialProgress ?? createInitialProgress()
  );

  // 游戏运行时状态
  const [gameStartTime, setGameStartTime] = useState(0);
  const [errors, setErrors] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [correctClickCount, setCorrectClickCount] = useState(0);
  const [lives, setLives] = useState(3);
  const [remainingTime, setRemainingTime] = useState<number | undefined>(undefined);
  // 每数字倒计时：从 timeLimitPerNumber 开始，每次点对下一个数字时重置。
  // undefined 表示该关无时限。耗尽即视为一次错误（扣命/失败）。
  const [perNumberTime, setPerNumberTime] = useState<number | undefined>(undefined);
  // 当前应点的目标数字 + 当前在交替/混合序列里的步进方向，供 HUD 实时提示。
  const [currentTarget, setCurrentTarget] = useState<number | null>(null);
  // 交替模式当前方向（正/反），HUD 只显示这个、不显示具体数字。
  const [currentDirection, setCurrentDirection] = useState<'正' | '反' | null>(null);
  const [lastResult, setLastResult] = useState<{
    stars: 0 | 1 | 2 | 3;
    score: number;
    completionTime: number;
    progressText?: string;
  } | null>(null);

  // refs：保存本次 playing 阶段最新值，供 timer/wrong-click 等 effect 读取，避免 stale closure
  const failGuardRef = useRef(false);  // 防止 fail 被多次触发
  // 计时器上次 tick 时间戳：单个 interval 贯穿整局，避免「interval 依赖 remainingTime
  // 而每 100ms 被重建」造成的卡顿/不生效问题。声明在 early return 之前以满足 hooks 规则。
  const lastTickRef = useRef(0);
  // 最新 handler 引用：每次 render 同步，让超时 effect 读到最新 handler 而非 stale 闭包。
  const handlersRef = useRef<{ onWrong: () => void; onFail: () => void }>({ onWrong: () => {}, onFail: () => {} });

  const config = getLevelConfig(currentLevel);
  if (!config) return null;

  const totalTime = config.timeLimitPerNumber
    ? config.timeLimitPerNumber * config.gridSize * config.gridSize
    : undefined;
  const N = config.gridSize * config.gridSize;

  // 失败处理：先定义，所有 effect/handler 都引用它
  const handleFail = useCallback(() => {
    if (failGuardRef.current) return;
    failGuardRef.current = true;

    const completionTime = gameStartTime > 0 ? (Date.now() - gameStartTime) / 1000 : 0;
    const progressText = `${Math.min(correctClickCount, N)}/${N}`;
    setLastResult({
      stars: 0,
      score: 0,
      completionTime,
      progressText,
    });
    setPhase('fail');
  }, [gameStartTime, correctClickCount, N]);

  // 通关处理：依赖当前所有计分输入
  const handleComplete = useCallback(() => {
    if (failGuardRef.current) return;

    const completionTime = (Date.now() - gameStartTime) / 1000;
    const stars = computeStars({
      passed: true,
      maxCombo,
      errorCount: errors,
      comboTarget: config.comboTarget,
    });
    const score = computeScore({
      level: currentLevel,
      timeLimitPerNumber: config.timeLimitPerNumber,
      maxCombo,
      remainingTime: remainingTime ?? 0,
    });

    // 更新进度：
    //   - stars 取历史最高（保留更高记录）
    //   - bestScore / bestCombo / bestTime 始终取更优（与星数提升解耦）
    //   - totalStars = sum(levelRecords[*].stars)，避免 (stars - oldStars) 为负
    const oldRecord = progress.levelRecords[currentLevel];
    const oldStars = oldRecord?.stars ?? 0;
    const bestStars = Math.max(oldStars, stars) as 1 | 2 | 3;
    const newRecords: typeof progress.levelRecords = {
      ...progress.levelRecords,
      [currentLevel]: {
        stars: bestStars,
        bestScore: Math.max(score, oldRecord?.bestScore ?? 0),
        bestCombo: Math.max(maxCombo, oldRecord?.bestCombo ?? 0),
        bestTime: Math.min(completionTime, oldRecord?.bestTime ?? Infinity),
      },
    };
    const newClearedLevel = Math.max(progress.clearedLevel, currentLevel);
    const newTotalStars = Object.values(newRecords).reduce(
      (sum, rec) => sum + (rec?.stars ?? 0),
      0,
    );
    const isLast = currentLevel === 10;

    const updated: SchulteQuestProgress = {
      ...progress,
      clearedLevel: newClearedLevel,
      totalStars: newTotalStars,
      levelRecords: newRecords,
      inProgressLevel: isLast ? undefined : currentLevel + 1,
    };
    setProgress(updated);
    saveQuestProgress(updated);

    setLastResult({ stars, score, completionTime });
    setPhase(isLast ? 'completed' : 'pass');

    if (soundEnabled) {
      playEffect('complete');
    }
  }, [gameStartTime, maxCombo, errors, config, currentLevel, remainingTime, progress, soundEnabled, playEffect]);

  // 进入关卡 intro 时持久化 inProgressLevel
  useEffect(() => {
    if (phase !== 'intro') return;
    failGuardRef.current = false; // 每关重置 guard

    setProgress((prev) => {
      const updated: SchulteQuestProgress = {
        ...prev,
        inProgressLevel: currentLevel,
      };
      void saveQuestProgress(updated);
      return updated;
    });
  }, [phase, currentLevel, saveQuestProgress]);

  // 计时器：仅在 playing + 有时限时启用。
  // 用 lastTickRef 记录上次 tick 时间戳，单个 interval 贯穿整局，避免「interval 依赖 remainingTime
  // 而每 100ms 被重建」造成的卡顿/不生效问题。
  useEffect(() => {
    if (phase !== 'playing' || !config.timeLimitPerNumber) return;

    lastTickRef.current = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      // clamp 到 0.1s 的整数倍，避免累积浮点误差
      const delta = Math.min(0.2, (now - lastTickRef.current) / 1000);
      lastTickRef.current = now;

      setPerNumberTime((prev) => {
        if (prev === undefined) return prev;
        return Math.max(0, prev - delta);
      });
      setRemainingTime((prev) => {
        if (prev === undefined) return prev;
        return Math.max(0, prev - delta);
      });
    }, 100);

    return () => clearInterval(interval);
  }, [phase, config.timeLimitPerNumber]);

  // 每数字倒计时耗尽 → 视为一次错误并重置该数字的倒计时。
  // 通过 handlersRef 读最新 handler，避免 stale closure（handleWrongClick 非 useCallback，
  // 直接放进依赖会每次 render 重跑 effect；ref 模式更稳定）。
  useEffect(() => {
    if (phase !== 'playing') return;
    if (perNumberTime !== undefined && perNumberTime <= 0) {
      handlersRef.current.onWrong();
      // 重置当前数字的时间窗，给玩家继续的机会
      setPerNumberTime(config.timeLimitPerNumber);
    }
    if (remainingTime !== undefined && remainingTime <= 0) {
      handlersRef.current.onFail();
    }
  }, [perNumberTime, remainingTime, phase, config.timeLimitPerNumber]);

  const handleStart = () => {
    setGameStartTime(Date.now());
    setErrors(0);
    setCombo(0);
    setMaxCombo(0);
    setCorrectClickCount(0);
    setLives(config.lives);
    setRemainingTime(totalTime);
    // 每数字倒计时：初始给满 timeLimitPerNumber
    setPerNumberTime(config.timeLimitPerNumber);
    setCurrentTarget(null);
    setCurrentDirection(null);
    failGuardRef.current = false;
    setPhase('playing');
  };

  const handleWrongClick = () => {
    if (failGuardRef.current) return;
    setErrors((prev) => prev + 1);
    if (soundEnabled) {
      playEffect('wrong');
    }
    // 用函数式更新避免闭包 lives 陈旧值，连续错点也能每次扣 1 命
    setLives((prevLives) => {
      const next = prevLives - 1;
      if (next <= 0) {
        handleFail();
      }
      return Math.max(0, next);
    });
  };

  // 每次 render 同步最新 handler 到 ref，让超时 effect 读到当前状态的 handler（soundEnabled 等）
  handlersRef.current.onWrong = handleWrongClick;
  handlersRef.current.onFail = handleFail;

  const handleComboChange = (newCombo: number) => {
    setCombo(newCombo);
    setMaxCombo((prev) => Math.max(prev, newCombo));
  };

  const handleCorrectClick = () => {
    setCorrectClickCount((prev) => prev + 1);
    // 点对一个数字 → 重置该数字的倒计时窗口
    if (config.timeLimitPerNumber) {
      setPerNumberTime(config.timeLimitPerNumber);
    }
    if (soundEnabled) {
      playEffect('tick');
    }
  };

  const handleTargetChange = (target: number | null) => {
    setCurrentTarget(target);
  };

  const handleDirectionChange = (dir: '正' | '反' | null) => {
    setCurrentDirection(dir);
  };

  const handleNext = () => {
    setCurrentLevel((prev) => Math.min(10, prev + 1));
    setLastResult(null);
    setPhase('intro');
  };

  const handleRetry = () => {
    setLastResult(null);
    setPhase('intro');
  };

  // 全通关"重新挑战"：回到第 1 关（与入口"重新闯关"语义一致）
  const handleRestartFromStart = () => {
    setCurrentLevel(1);
    setLastResult(null);
    setPhase('intro');
  };

  // 全通关总用时（秒）：累加各关 bestTime
  const totalClearedTime = Object.values(progress.levelRecords).reduce(
    (sum, rec) => sum + (rec?.bestTime ?? 0),
    0
  );

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-32">
      {/* 轻量 header（不使用 GameControlBar） */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onExit}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="text-lg">←</span>
          <span>退出</span>
        </button>
        <span className="font-headline text-base font-extrabold">
          舒尔特闯关 · 第 {currentLevel} 关
        </span>
        <span className="w-12" />
      </div>

      {phase === 'intro' && (
        <QuestLevelIntro level={currentLevel} onStart={handleStart} />
      )}

      {phase === 'playing' && (
        <>
          <QuestHUD
            level={currentLevel}
            direction={config.direction}
            lives={lives}
            combo={combo}
            remainingTime={remainingTime}
            totalTime={totalTime}
          />
          <SchulteGrid
            gridSize={config.gridSize}
            order={config.direction}
            expectedSequence={
              config.direction === 'mixed'
                ? generateMixedSequence(config.gridSize, gameStartTime)
                : undefined
            }
            isActive={true}
            startTime={gameStartTime}
            onCorrectClick={handleCorrectClick}
            onWrongClick={handleWrongClick}
            onComplete={handleComplete}
            onComboChange={handleComboChange}
            onTargetChange={handleTargetChange}
            onDirectionChange={handleDirectionChange}
            floatingTarget={{
              target: currentTarget,
              direction: currentDirection,
              perNumberTime,
              perNumberTotal: config.timeLimitPerNumber,
              isAlternate: config.direction === 'alternate',
            }}
          />
        </>
      )}

      {phase === 'pass' && lastResult && (
        <QuestResultDialog
          type="pass"
          level={currentLevel}
          stars={lastResult.stars}
          score={lastResult.score}
          maxCombo={maxCombo}
          completionTime={lastResult.completionTime}
          isLastLevel={false}
          onNext={handleNext}
          onRetry={handleRetry}
        />
      )}

      {phase === 'fail' && lastResult && (
        <QuestResultDialog
          type="fail"
          level={currentLevel}
          maxCombo={maxCombo}
          progressText={lastResult.progressText ?? ''}
          onRetry={handleRetry}
          onExit={onExit}
        />
      )}

      {phase === 'completed' && (
        <QuestResultDialog
          type="completed"
          totalStars={progress.totalStars}
          totalTime={totalClearedTime}
          onRestart={handleRestartFromStart}
        />
      )}
    </div>
  );
}
