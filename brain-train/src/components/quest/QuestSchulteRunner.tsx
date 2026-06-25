// Schulte 适配器：按难度渲染 SchulteGrid，聚合回调产出 QuestResult
//
// 注意：SchulteGrid 组件不内置 timeLimitPerNumber/lives（那是页面层逻辑）。
// 本 Runner 当前只用 gridSize/order/combo/errors 维度算星级；
// timeLimitPerNumber/lives 暂不实现（留作后续扩展，不影响其他维度）。
import { useRef, useCallback, useState } from 'react';
import { SchulteGrid } from '@/components/game/SchulteGrid';
import { getDifficulty } from '@/lib/questGameConfig';
import { computeStars } from '@/lib/schulteQuestConfig';
import type { SchulteDifficultyParams, QuestResult } from '@/types/quest';
import type { RunnerProps } from './QuestRunner';

export function QuestSchulteRunner({ difficulty, onComplete }: RunnerProps) {
  const level = getDifficulty('schulte', difficulty);
  const { gridSize, direction } = level.params as SchulteDifficultyParams;

  // SchulteGrid startTime 变化即重置；用 difficulty 作为 key 保证每次进入都是新局
  const [startTime] = useState(() => Date.now());

  // 用 ref 聚合分散回调，避免 SchulteGrid 的 onComplete 无参数问题
  const maxComboRef = useRef(0);
  const errorCountRef = useRef(0);

  const handleComboChange = useCallback((combo: number) => {
    if (combo > maxComboRef.current) maxComboRef.current = combo;
  }, []);

  const handleWrongClick = useCallback(() => {
    errorCountRef.current += 1;
  }, []);

  const handleComplete = useCallback(() => {
    const maxCombo = maxComboRef.current;
    const errorCount = errorCountRef.current;
    const stars = computeStars({
      passed: true,
      maxCombo,
      errorCount,
      comboTarget: level.comboTarget ?? 10,
    });
    // 分数：基础分(100×难度) + combo 奖励；仅展示用
    const score = Math.round(100 * difficulty + maxCombo * 5 - errorCount * 3);

    const result: QuestResult = {
      gameId: 'schulte',
      difficulty,
      passed: true,
      stars,
      score: Math.max(0, score),
      details: { maxCombo, errorCount },
    };
    onComplete(result);
  }, [difficulty, level.comboTarget, onComplete]);

  return (
    <SchulteGrid
      gridSize={gridSize}
      order={direction}
      isActive={true}
      startTime={startTime}
      onCorrectClick={() => {}}
      onWrongClick={handleWrongClick}
      onComboChange={handleComboChange}
      onComplete={handleComplete}
    />
  );
}
