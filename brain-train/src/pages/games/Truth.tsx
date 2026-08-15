import { LogicSessionShell } from '../../components/game/LogicSessionShell';
import { TruthGame } from '../../components/game/TruthGame';

export function Truth() {
  return (
    <LogicSessionShell
      mode="truth"
      title="真假岛"
      description="演绎推理训练"
      engineLevels={{ easy: [3, 3], medium: [4, 5], hard: [6, 6] }}
      renderRound={(p) => <TruthGame {...p} />}
    />
  );
}
