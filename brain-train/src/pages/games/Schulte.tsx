import { useState, useCallback, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAudio } from '../../hooks/useAudio';
import { SchulteGrid } from '../../components/game/SchulteGrid';
import { ScoreBoard } from '../../components/game/ScoreBoard';
import { Timer } from '../../components/game/Timer';
import type { TrainingDetails } from '../../types';

// 固定5x5配置
const GRID_SIZE = 5;
const GRID_ORDER = 'asc' as const;

export function Schulte() {
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

  const handleComplete = useCallback(() => {
    const endTime = Date.now();
    const totalTime = (endTime - gameStartTime) / 1000;

    // Calculate score: base 1000 - time penalty - error penalty
    const maxNumber = GRID_SIZE * GRID_SIZE;
    const timePenalty = Math.floor(totalTime * 10);
    const errorPenalty = errors * 50;
    const score = Math.max(0, 1000 - timePenalty - errorPenalty + maxNumber * 10);

    const accuracy = Math.round(((maxNumber - errors) / maxNumber) * 100);

    const details: TrainingDetails = {
      gridSize: GRID_SIZE,
      order: GRID_ORDER,
      completionTime: totalTime,
      errorCount: errors,
      clickSequence
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
    <div className="max-w-2xl mx-auto px-6 pt-4 pb-24">
      {/* Header - Focus Point Style */}
      <div className="mb-8 self-start">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-2 font-headline">
          Focus Point
        </h1>
        <p className="text-muted-foreground text-sm font-medium tracking-wide">
          Find numbers 1-25 in sequential order while keeping your eyes fixed on the center.
        </p>
      </div>

      {/* Game Stats */}
      {isPlaying && (
        <div className="mb-6 flex justify-between items-center">
          <Timer seconds={elapsedTime} isRunning size="md" />
          <div className="text-sm text-muted-foreground">
            Time: <span className="font-bold text-foreground">{elapsedTime.toFixed(1)}s</span>
          </div>
        </div>
      )}

      {/* Game Grid */}
      <div className="mb-8">
        <SchulteGrid
          order={GRID_ORDER}
          onCorrectClick={handleCorrectClick}
          onWrongClick={handleWrongClick}
          isActive={isPlaying}
          startTime={gameStartTime}
        />
      </div>

      {/* Metrics - Target, Accuracy, Avg Speed */}
      {isPlaying && (
        <div className="mb-8 flex justify-center gap-12">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">Target</span>
            <span className="text-secondary text-2xl font-bold font-headline">
              {String(clickSequence.length + 1).padStart(2, '0')}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">Accuracy</span>
            <span className="text-foreground text-2xl font-bold font-headline">
              {clickSequence.length > 0
                ? Math.round((clickSequence.length / (clickSequence.length + errors)) * 100)
                : 100}%
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">Errors</span>
            <span className="text-foreground text-2xl font-bold font-headline">{errors}</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex justify-center gap-4">
        {!isPlaying && !showResult && (
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all active:scale-95 shadow-lg"
          >
            Start Training
          </button>
        )}

        {isPlaying && (
          <button
            onClick={handleComplete}
            className="px-6 py-2 border border-border rounded-xl hover:bg-accent transition-all active:scale-95"
          >
            End Session
          </button>
        )}

        {showResult && (
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all active:scale-95 shadow-lg"
          >
            Play Again
          </button>
        )}
      </div>

      {/* Result Modal */}
      {showResult && (
        <div className="mt-8 p-6 bg-surface-container-low dark:bg-[#131b2e] rounded-2xl border border-border">
          <h3 className="text-lg font-semibold mb-4 text-center font-headline">Training Complete!</h3>
          <ScoreBoard
            score={finalScore}
            accuracy={Math.round(((GRID_SIZE * GRID_SIZE - errors) / (GRID_SIZE * GRID_SIZE)) * 100)}
          />
          <div className="mt-4 text-center text-sm text-muted-foreground space-y-1">
            <p>Time: {elapsedTime.toFixed(2)}s</p>
            <p>Errors: {errors}</p>
          </div>
        </div>
      )}
    </div>
  );
}
