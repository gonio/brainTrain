// 逻辑谜题闯关 Runner 工厂：单题、最多 3 次作答、尝试次数制评星
import { getDifficulty } from '@/lib/questGameConfig';
import { starsForAttempts, type LogicRoundOutcome } from '@/lib/logic/attempts';
import type { LogicRoundProps } from '@/components/game/LogicSessionShell';
import type { GameId, LogicPuzzleDifficultyParams, QuestResult } from '@/types/quest';
import type { RunnerProps } from './QuestRunner';

export function makeLogicRunner(
  gameId: GameId,
  Component: React.ComponentType<LogicRoundProps>,
): React.FC<RunnerProps> {
  return function LogicQuestRunner({ difficulty, onComplete }: RunnerProps) {
    const level = getDifficulty(gameId, difficulty);
    const { engineLevel } = level.params as LogicPuzzleDifficultyParams;

    const handleRoundEnd = (o: LogicRoundOutcome) => {
      const stars = o.correct ? starsForAttempts(o.attempts) : 0;
      const result: QuestResult = {
        gameId,
        difficulty,
        passed: o.correct,              // 3 次全错 = 闯关失败，重挑本关
        stars,
        score: o.correct ? Math.round((stars / 3) * 100) : 0,
        details: { engineLevel, correct: o.correct, attempts: o.attempts },
      };
      onComplete(result);
    };

    return <Component engineLevel={engineLevel} isActive={true} onRoundEnd={handleRoundEnd} />;
  };
}
