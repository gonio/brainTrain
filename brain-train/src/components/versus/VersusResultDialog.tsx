import type { VersusGameEnd, GameMode, PlayerResult } from '../../types/versus';

interface VersusResultDialogProps {
  result: VersusGameEnd;
  mode: GameMode;
  detail?: Record<string, unknown>;
  onPlayAgain: () => void;   // 单局：再来一局；多局中途：下一局
  onExit: () => void;
  playAgainLabel?: string;   // 默认「再来一局」，多局可传「下一局」
}

// 各游戏 mode 的指标行（基于后端实际下发的 detail 字段）。detail 为空时返回 null，
// 调用方退化为只显示 accuracy + timeMs。
// 后端 detail 字段（见 server/src/games/*Engine.ts）：
//   schulte:  { found, errors }
//   stroop:   { answered, correct, errors }
//   sequence: { positionCorrect }
//   bottle:   { matched, total }
function modeMetric(mode: GameMode, detail: Record<string, unknown> | undefined): { left: string; right: string } | null {
  if (!detail) return null;
  const num = (k: string) => typeof detail[k] === 'number' ? (detail[k] as number) : undefined;
  if (mode === 'schulte') {
    const found = num('found');
    const errors = num('errors');
    if (found === undefined) return null;
    return {
      left: `${found} 对`,
      right: errors !== undefined && errors > 0 ? `${errors} 错点` : '',
    };
  }
  if (mode === 'stroop') {
    const correct = num('correct');
    const errors = num('errors');
    if (correct === undefined) return null;
    return {
      left: `${correct} 对`,
      right: errors !== undefined && errors > 0 ? `${errors} 错` : '',
    };
  }
  if (mode === 'sequence') {
    const pc = num('positionCorrect');
    if (pc === undefined) return null;
    return { left: `${pc} 位置对`, right: '' };
  }
  if (mode === 'bottle') {
    const matched = num('matched');
    const total = num('total');
    if (matched === undefined) return null;
    return {
      left: total !== undefined ? `${matched} / ${total} 匹配` : `${matched} 匹配`,
      right: '',
    };
  }
  return null;
}

export function VersusResultDialog({ result, mode, detail, onPlayAgain, onExit, playAgainLabel }: VersusResultDialogProps) {
  const { winner, myResult, opponentResult } = result;
  const title = winner === 'me' ? '胜利！' : winner === 'opponent' ? '失败' : '平局';
  const titleColor = winner === 'me' ? 'text-success' : winner === 'opponent' ? 'text-destructive' : 'text-muted-foreground';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6">
      <div className="bg-surface rounded-3xl p-8 max-w-sm w-full shadow-2xl">
        <h2 className={`font-headline text-4xl font-extrabold text-center mb-6 ${titleColor}`}>{title}</h2>
        <div className="space-y-3 mb-6">
          <ResultRow label="我" result={myResult} highlight={winner === 'me'} mode={mode} detail={detail} />
          <ResultRow label="对手" result={opponentResult} highlight={winner === 'opponent'} mode={mode} detail={detail} />
        </div>
        <div className="space-y-3">
          <button
            onClick={onPlayAgain}
            className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-2xl hover:opacity-90 transition-opacity"
          >
            {playAgainLabel ?? '再来一局'}
          </button>
          <button
            onClick={onExit}
            className="w-full py-3 bg-surface-container text-foreground font-bold rounded-2xl hover:bg-surface-container-high transition-colors"
          >
            返回大厅
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultRow({ label, result, highlight, mode, detail }: { label: string; result: PlayerResult; highlight: boolean; mode: GameMode; detail?: Record<string, unknown> }) {
  const metric = modeMetric(mode, detail);
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl ${highlight ? 'bg-success/10' : 'bg-surface-container'}`}>
      <span className="font-bold">{label}</span>
      <div className="text-right text-sm">
        <div>正确率 <span className="font-bold">{(result.accuracy * 100).toFixed(1)}%</span></div>
        {metric ? (
          <div className="text-muted-foreground">
            {metric.left}{metric.right && <span className="ml-2 text-destructive">{metric.right}</span>}
            {' · '}{(result.timeMs / 1000).toFixed(1)}s
          </div>
        ) : (
          <div className="text-muted-foreground">{result.found} 对 / {result.errors} 错 · {(result.timeMs / 1000).toFixed(1)}s</div>
        )}
      </div>
    </div>
  );
}
