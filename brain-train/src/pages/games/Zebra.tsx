import { LogicSessionShell } from '../../components/game/LogicSessionShell';
import { ZebraGame } from '../../components/game/ZebraGame';

export function Zebra() {
  return (
    <LogicSessionShell
      mode="zebra"
      title="左邻右舍"
      description="演绎推理训练"
      engineLevels={{ easy: [1, 7], medium: [8, 14], hard: [15, 20] }}
      renderRound={(p) => <ZebraGame {...p} />}
    />
  );
}
