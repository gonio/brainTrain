// Bottle 适配器：按难度渲染 BottleGame，监听 onComplete 翻译为 QuestResult
import { useState, useCallback } from 'react';
import { BottleGame } from '@/components/game/BottleGame';
import { getDifficulty } from '@/lib/questGameConfig';
import { useAudio } from '@/hooks/useAudio';
import { useSettingsStore } from '@/stores/settingsStore';
import type { BottleDifficultyParams } from '@/types/quest';
import type { RunnerProps } from './QuestRunner';

export function QuestBottleRunner({ difficulty, onComplete }: RunnerProps) {
  const level = getDifficulty('bottle', difficulty);
  const { bottleCount, timeLimit } = level.params as BottleDifficultyParams;
  // startTime 作为 BottleGame 每局重新生成的标识
  const [startTime] = useState(() => Date.now());

  const { soundEnabled } = useSettingsStore();
  const { playEffect } = useAudio();

  const handleSwap = useCallback(() => {
    if (soundEnabled) {
      playEffect('tick');
    }
  }, [soundEnabled, playEffect]);

  const handleComplete = useCallback(
    (totalSwaps: number, optimalSwaps: number, _t: string[], _p: string[], timedOutAndIncomplete?: boolean) => {
      // 超时未完成 → 失败
      if (timedOutAndIncomplete) {
        onComplete({
          gameId: 'bottle',
          difficulty,
          passed: false,
          stars: 0,
          score: 0,
          details: { totalSwaps, optimalSwaps },
        });
        return;
      }
      // 星级按步数倍率：goodThreshold=1.5 → swaps≤optimal×1.5 得 2 星；excellent=1.0 → swaps≤optimal 得 3 星
      let stars: 0 | 1 | 2 | 3 = 1;
      if (totalSwaps <= optimalSwaps * level.excellentThreshold) stars = 3;
      else if (totalSwaps <= optimalSwaps * level.goodThreshold) stars = 2;

      onComplete({
        gameId: 'bottle',
        difficulty,
        passed: true,
        stars,
        score: optimalSwaps > 0 ? Math.round((optimalSwaps / totalSwaps) * 100) : 100,
        details: { totalSwaps, optimalSwaps },
      });
      if (soundEnabled) {
        playEffect('complete');
      }
    },
    [difficulty, level.goodThreshold, level.excellentThreshold, onComplete, soundEnabled, playEffect],
  );

  return (
    <BottleGame
      bottleCount={bottleCount}
      isActive={true}
      startTime={startTime}
      timeLimit={timeLimit}
      onSwap={handleSwap}
      onComplete={handleComplete}
    />
  );
}
