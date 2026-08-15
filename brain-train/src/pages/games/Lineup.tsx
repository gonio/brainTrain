import { LogicSessionShell } from '../../components/game/LogicSessionShell';
import { LineupGame } from '../../components/game/LineupGame';

export function Lineup() {
  return (
    <LogicSessionShell
      mode="lineup"
      title="排排坐"
      description="演绎推理训练"
      engineLevels={{ easy: [1, 7], medium: [8, 14], hard: [15, 20] }}
      renderRound={(p) => <LineupGame {...p} />}
    />
  );
}
