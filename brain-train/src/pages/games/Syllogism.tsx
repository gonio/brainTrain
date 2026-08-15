import { LogicSessionShell } from '../../components/game/LogicSessionShell';
import { SyllogismGame } from '../../components/game/SyllogismGame';

export function Syllogism() {
  return (
    <LogicSessionShell
      mode="syllogism"
      title="说得通吗"
      description="判断三段论的推理形式是否有效"
      engineLevels={{ easy: [1, 7], medium: [8, 14], hard: [15, 20] }}
      renderRound={(p) => <SyllogismGame {...p} />}
    />
  );
}
