// Runner 分发器：按 gameId 渲染对应适配器。
// 开局先显示 3 秒倒计时缓冲，结束后才挂载具体 Runner，
// 保证倒计时期间游戏组件不计时（适配器把 isActive 硬编码为 true，挂载即开始）。
// 每次进/切关都会重新挂载本组件，倒计时随之自动重启。
import { useEffect } from 'react';
import type { GameId, QuestResult } from '@/types/quest';
import { QuestSchulteRunner } from './QuestSchulteRunner';
import { QuestSequenceRunner } from './QuestSequenceRunner';
import { QuestStroopRunner } from './QuestStroopRunner';
import { QuestBottleRunner } from './QuestBottleRunner';
import { useStartCountdown } from '@/hooks/useStartCountdown';

export interface RunnerProps {
  difficulty: number;
  onComplete: (result: QuestResult) => void;
}

const RUNNERS: Record<GameId, React.ComponentType<RunnerProps>> = {
  schulte: QuestSchulteRunner,
  sequence: QuestSequenceRunner,
  stroop: QuestStroopRunner,
  bottle: QuestBottleRunner,
};

export function QuestRunner({
  gameId,
  difficulty,
  onComplete,
}: { gameId: GameId } & RunnerProps) {
  // 倒计时缓冲：挂载即触发。trigger() 内部会先清理上一次的 interval，
  // 因此即便 React StrictMode 双挂载（挂载→卸载→再挂载）重复调用 trigger 也安全，
  // 不会出现「卸载清理了 interval、再挂载时被 ref 守卫跳过」导致倒计时卡死。
  // phase==='ready' 才渲染 Runner，防止倒计时期间游戏组件提前启动计时。
  const { phase, overlay, trigger } = useStartCountdown();
  useEffect(() => {
    trigger(() => {});
  }, [trigger]);

  const Runner = RUNNERS[gameId];
  return (
    <>
      {phase === 'ready' && <Runner difficulty={difficulty} onComplete={onComplete} />}
      {overlay}
    </>
  );
}
