// Sequence 适配器：按难度渲染 SequenceGame，监听 onComplete 翻译为 QuestResult
import { useCallback } from 'react';
import { SequenceGame } from '@/components/game/SequenceGame';
import { getDifficulty, getSequenceFailThreshold } from '@/lib/questGameConfig';
import { useAudio } from '@/hooks/useAudio';
import { useSettingsStore } from '@/stores/settingsStore';
import type { SequenceDifficultyParams } from '@/types/quest';
import type { RunnerProps } from './QuestRunner';

export function QuestSequenceRunner({ difficulty, onComplete }: RunnerProps) {
  const level = getDifficulty('sequence', difficulty);
  const { sequenceLength, displayMode, distractors, answerTimeLimit } =
    level.params as SequenceDifficultyParams;

  const { soundEnabled } = useSettingsStore();
  const { playEffect } = useAudio();

  const handleComplete = useCallback((result: {
    sequence: string[];
    userSequence: string[];
    positionAccuracy: number;
    itemAccuracy: number;
    hasDistractors: boolean;
  }) => {
    // 准确率：有干扰项时 位置 60% + 物品 40%；无干扰项时只看位置准确率（与自由模式一致）
    const accuracy = result.hasDistractors
      ? result.positionAccuracy * 0.6 + result.itemAccuracy * 0.4
      : result.positionAccuracy;
    let stars: 0 | 1 | 2 | 3 = 1;
    if (accuracy >= level.excellentThreshold) stars = 3;
    else if (accuracy >= level.goodThreshold) stars = 2;

    // 失败判定：答错位置数 ≥ 难度阈值（1-8级=⌈长度/2⌉，9级=3，10级=2）
    const wrongPositions = result.sequence.filter((s, i) => s !== result.userSequence[i]).length;
    const failed = wrongPositions >= getSequenceFailThreshold(difficulty);

    onComplete({
      gameId: 'sequence',
      difficulty,
      passed: !failed,
      stars: failed ? 0 : stars,
      score: Math.round(accuracy),
      details: result,
    });
    if (soundEnabled) {
      playEffect(failed ? 'wrong' : accuracy > 80 ? 'complete' : 'tick');
    }
  }, [difficulty, level.goodThreshold, level.excellentThreshold, onComplete, soundEnabled, playEffect]);

  return (
    <SequenceGame
      sequenceLength={sequenceLength}
      isActive={true}
      displayMode={displayMode}
      distractors={distractors}
      answerTimeLimit={answerTimeLimit}
      onComplete={handleComplete}
    />
  );
}
