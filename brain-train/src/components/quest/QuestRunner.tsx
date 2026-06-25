// Runner 分发器：按 gameId 渲染对应适配器
import type { GameId, QuestResult } from '@/types/quest';
import { QuestSchulteRunner } from './QuestSchulteRunner';
import { QuestSequenceRunner } from './QuestSequenceRunner';
import { QuestStroopRunner } from './QuestStroopRunner';
import { QuestBottleRunner } from './QuestBottleRunner';

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
  const Runner = RUNNERS[gameId];
  return <Runner difficulty={difficulty} onComplete={onComplete} />;
}
