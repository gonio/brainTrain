// 主线闯关页面：Hub ↔ Playing ↔ Result 状态机
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuestHub, QuestHUD, QuestRunner, QuestResultDialog } from '@/components/quest';
import { pickNextGame, applyResult } from '@/lib/questEngine';
import { getQuestProgressRecord, saveQuestProgressRecord } from '@/db/queries';
import type { QuestProgress, GameId, QuestResult } from '@/types/quest';

type View = 'hub' | 'playing' | 'result';

export function Quest() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<QuestProgress | null>(null);
  const [view, setView] = useState<View>('hub');
  const [currentGame, setCurrentGame] = useState<GameId | null>(null);
  const [currentDifficulty, setCurrentDifficulty] = useState(1);
  const [lastResult, setLastResult] = useState<QuestResult | null>(null);

  // 加载存档
  useEffect(() => {
    getQuestProgressRecord().then(setProgress);
  }, []);

  const handleStart = useCallback(() => {
    if (!progress) return;
    const game = pickNextGame(progress);
    if (!game) return;
    setCurrentGame(game);
    setCurrentDifficulty(progress.progress[game] + 1);
    setLastResult(null);
    setView('playing');
  }, [progress]);

  const handleComplete = useCallback(async (result: QuestResult) => {
    if (!progress) return;
    const updated = applyResult(progress, result);
    await saveQuestProgressRecord(updated);
    setProgress(updated);
    setLastResult(result);
    setView('result');
  }, [progress]);

  const handleNext = useCallback(() => {
    if (!progress) return;
    const game = pickNextGame(progress);
    if (!game) {
      setView('hub');
      return;
    }
    setCurrentGame(game);
    setCurrentDifficulty(progress.progress[game] + 1);
    setLastResult(null);
    setView('playing');
  }, [progress]);

  const handleExit = useCallback(() => {
    setView('hub');
    setCurrentGame(null);
    setLastResult(null);
  }, []);

  const handleBack = useCallback(() => navigate('/'), [navigate]);

  if (!progress) {
    return <div className="text-center py-12 text-muted-foreground">加载中…</div>;
  }

  if (view === 'hub') {
    return <QuestHub progress={progress} onStart={handleStart} onBack={handleBack} />;
  }

  if (view === 'playing' && currentGame) {
    return (
      <div className="max-w-3xl mx-auto">
        <QuestHUD gameId={currentGame} difficulty={currentDifficulty} onExit={handleExit} />
        <div className="pt-4">
          <QuestRunner
            gameId={currentGame}
            difficulty={currentDifficulty}
            onComplete={handleComplete}
          />
        </div>
      </div>
    );
  }

  // view === 'result'
  return (
    <QuestResultDialog
      result={lastResult!}
      isCleared={progress.completed}
      onNext={handleNext}
      onHub={handleExit}
    />
  );
}
