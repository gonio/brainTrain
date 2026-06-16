import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAudio } from '../../hooks/useAudio';
import { SchulteGrid } from '../../components/game/SchulteGrid';
import { ScoreBoard } from '../../components/game/ScoreBoard';
import { GameControlBar } from '../../components/game/GameControlBar';
import { GameStartScreen } from '../../components/game/GameStartScreen';
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

  // 挂载时立刻加载进度（入口页副标题需要显示真实状态，而不是 fallback 文案）
  useEffect(() => {
    getQuestProgress().then(setProgress);
  }, []);

  const handleQuestClick = () => {
    const p = progress ?? createInitialProgress();
    // 三种入口分支：
    //   全新玩家（无进度）→ 直接进入第 1 关，不显示弹窗
    //   其他（有 inProgressLevel、有已通关记录、已全通关）→ 显示弹窗让用户选
    if (!p.inProgressLevel && p.clearedLevel === 0) {
      setMode('quest');
    } else {
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

// 占位：Task 11 替换为完整状态机实现
function SchulteQuest({ onExit }: { initialProgress: SchulteQuestProgress | null; onExit: () => void }) {
  return (
    <div className="max-w-md mx-auto px-6 pt-8 pb-32 text-center">
      <p className="text-muted-foreground">闯关模式即将上线</p>
      <button onClick={onExit} className="mt-4 text-sm text-primary">← 返回</button>
    </div>
  );
}
