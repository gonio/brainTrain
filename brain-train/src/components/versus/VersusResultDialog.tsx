import type { GameEndPayload, PlayerResult } from '../../types/versus';

interface VersusResultDialogProps {
  result: GameEndPayload;
  onPlayAgain: () => void;
  onExit: () => void;
}

export function VersusResultDialog({ result, onPlayAgain, onExit }: VersusResultDialogProps) {
  const { winner, myResult, opponentResult } = result;
  const title = winner === 'me' ? '胜利！' : winner === 'opponent' ? '失败' : '平局';
  const titleColor = winner === 'me' ? 'text-success' : winner === 'opponent' ? 'text-destructive' : 'text-muted-foreground';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6">
      <div className="bg-surface rounded-3xl p-8 max-w-sm w-full shadow-2xl">
        <h2 className={`font-headline text-4xl font-extrabold text-center mb-6 ${titleColor}`}>{title}</h2>
        <div className="space-y-3 mb-6">
          <ResultRow label="我" result={myResult} highlight={winner === 'me'} />
          <ResultRow label="对手" result={opponentResult} highlight={winner === 'opponent'} />
        </div>
        <div className="space-y-3">
          <button
            onClick={onPlayAgain}
            className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-2xl hover:opacity-90 transition-opacity"
          >
            再来一局
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

function ResultRow({ label, result, highlight }: { label: string; result: PlayerResult; highlight: boolean }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl ${highlight ? 'bg-success/10' : 'bg-surface-container'}`}>
      <span className="font-bold">{label}</span>
      <div className="text-right text-sm">
        <div>正确率 <span className="font-bold">{(result.accuracy * 100).toFixed(1)}%</span></div>
        <div className="text-muted-foreground">{result.found} 对 / {result.errors} 错 · {(result.timeMs / 1000).toFixed(1)}s</div>
      </div>
    </div>
  );
}
