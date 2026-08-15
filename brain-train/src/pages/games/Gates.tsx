import { LogicSessionShell } from '../../components/game/LogicSessionShell';
import { GatesGame } from '../../components/game/GatesGame';

export function Gates() {
  return (
    <LogicSessionShell
      mode="gates"
      title="逻辑门"
      description="规则推演训练"
      engineLevels={{ easy: [1, 6], medium: [7, 13], hard: [14, 20] }}
      renderRound={(p) => <GatesGame {...p} />}
    />
  );
}
