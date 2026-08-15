import { LogicSessionShell } from '../../components/game/LogicSessionShell';
import { FallacyGame } from '../../components/game/FallacyGame';

export function Fallacy() {
  return (
    <LogicSessionShell
      mode="fallacy"
      title="找谬误"
      description="谬误批判训练"
      engineLevels={{ easy: [1, 1], medium: [2, 2], hard: [3, 3] }}
      renderRound={(p) => <FallacyGame {...p} />}
    />
  );
}
