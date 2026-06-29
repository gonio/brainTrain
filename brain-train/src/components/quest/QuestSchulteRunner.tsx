// Schulte 适配器：按难度渲染 SchulteGrid，聚合回调产出 QuestResult
//
// 失败机制：错点次数 ≥ lives → 失败（passed:false, stars:0），立即停止棋盘。
// lives 来自难度表（1-6级=3，7-9=2，10级=1）。
//
// 与其它 Runner 不同：SchulteGrid 不自带音效，本 Runner 负责接上音效；
// 同时渲染 QuestHUD + 棋盘浮动提示（floatingTarget）告知玩家当前方向/目标。
import { useRef, useCallback, useState } from 'react';
import { SchulteGrid } from '@/components/game/SchulteGrid';
import { QuestHUD } from '@/components/game/QuestHUD';
import { getDifficulty } from '@/lib/questGameConfig';
import { computeStars } from '@/lib/schulteQuestConfig';
import { useAudio } from '@/hooks/useAudio';
import { useSettingsStore } from '@/stores/settingsStore';
import type { SchulteDifficultyParams, QuestResult } from '@/types/quest';
import type { StepDirection } from '@/lib/schulteQuestConfig';
import type { RunnerProps } from './QuestRunner';

export function QuestSchulteRunner({ difficulty, onComplete }: RunnerProps) {
  const level = getDifficulty('schulte', difficulty);
  const { gridSize, direction, lives } = level.params as SchulteDifficultyParams;
  const maxLives = lives ?? 3;

  // SchulteGrid startTime 变化即重置；用 difficulty 作为 key 保证每次进入都是新局
  const [startTime] = useState(() => Date.now());

  // 用 ref 聚合分散回调，避免 SchulteGrid 的 onComplete 无参数问题
  const maxComboRef = useRef(0);
  const errorCountRef = useRef(0);
  // 错点明细：结算时进 details，供结算页展示「点了X / 应点Y」对比
  const errorsRef = useRef<{ clicked: number; expected: number }[]>([]);
  // 失败/完成后停止棋盘点击
  // completedRef：防 onComplete 重复调用（回调可能多次触发）；stopped：驱动重渲染让 isActive 生效
  const completedRef = useRef(false);
  const [stopped, setStopped] = useState(false);

  const { soundEnabled } = useSettingsStore();
  const { playEffect } = useAudio();

  // 棋盘浮动提示状态
  const [target, setTarget] = useState<number | null>(null);
  const [currentDir, setCurrentDir] = useState<StepDirection | null>(null);

  const isAlternate = direction === 'alternate';

  // 固定方向关卡（asc/desc）只显示方向标签（正/反），不显示下一个数字；
  // alternate 显示当前方向；mixed 没有正反概念，仍显示数字。
  // displayDir 为要显示的方向；有方向就不显示数字。
  const FIXED_DIR: Record<string, StepDirection> = { asc: '正', desc: '反' };
  const displayDir: StepDirection | null = isAlternate
    ? currentDir
    : FIXED_DIR[direction] ?? null;

  const handleComboChange = useCallback((combo: number) => {
    if (combo > maxComboRef.current) maxComboRef.current = combo;
  }, []);

  const handleWrongClick = useCallback((info: { clicked: number; expected: number }) => {
    if (completedRef.current) return; // 已结算（含失败），忽略后续点击
    errorCountRef.current += 1;
    errorsRef.current.push(info);
    if (soundEnabled) {
      playEffect('wrong');
    }
    // 错点耗尽生命 → 失败
    if (errorCountRef.current >= maxLives) {
      completedRef.current = true;
      setStopped(true);
      const result: QuestResult = {
        gameId: 'schulte',
        difficulty,
        passed: false,
        stars: 0,
        score: 0,
        details: {
          maxCombo: maxComboRef.current,
          errorCount: errorCountRef.current,
          errors: errorsRef.current,
        },
      };
      onComplete(result);
      if (soundEnabled) playEffect('wrong');
    }
  }, [difficulty, maxLives, onComplete, soundEnabled, playEffect]);

  const handleCorrectClick = useCallback(() => {
    if (soundEnabled) {
      playEffect('tick');
    }
  }, [soundEnabled, playEffect]);

  const handleTargetChange = useCallback((t: number | null) => {
    setTarget(t);
  }, []);

  const handleDirectionChange = useCallback((d: StepDirection | null) => {
    setCurrentDir(d);
  }, []);

  const handleComplete = useCallback(() => {
    if (completedRef.current) return; // 已结算（失败或完成），忽略重复
    completedRef.current = true;
    setStopped(true);
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
      details: { maxCombo, errorCount, errors: errorsRef.current },
    };
    onComplete(result);
    if (soundEnabled) {
      playEffect('complete');
    }
  }, [difficulty, level.comboTarget, onComplete, soundEnabled, playEffect]);

  return (
    <>
      <QuestHUD
        level={difficulty}
        direction={direction}
        lives={Math.max(0, maxLives - errorCountRef.current)}
        combo={0}
      />
      <SchulteGrid
        gridSize={gridSize}
        order={direction}
        isActive={!stopped}
        startTime={startTime}
        onCorrectClick={handleCorrectClick}
        onWrongClick={handleWrongClick}
        onComboChange={handleComboChange}
        onTargetChange={handleTargetChange}
        onDirectionChange={isAlternate ? handleDirectionChange : undefined}
        onComplete={handleComplete}
        floatingTarget={{
          // 有方向就只显示方向（正/反），不显示下一个数字
          target: displayDir ? null : target,
          direction: displayDir,
          isAlternate: !!displayDir,
        }}
      />
    </>
  );
}
