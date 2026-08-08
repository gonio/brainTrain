import type { RoundGameResult, VersusPlayer, GameMode } from '@/types/versus';

interface RoundResultDialogProps {
  roundResults: RoundGameResult[];
  players: VersusPlayer[];
  myUserId: string;
  onReconfigure: () => void;   // 房主：更换游戏
  onExit: () => void;
  canReconfigure: boolean;     // 是否房主
}

const MODE_LABELS: Record<GameMode, string> = {
  schulte: '舒尔特',
  stroop: '字色',
  sequence: '序列',
  bottle: '暗瓶',
};

export function RoundResultDialog({ roundResults, players, myUserId, onReconfigure, onExit, canReconfigure }: RoundResultDialogProps) {
  // 统计双方各赢几局
  const wins: Record<string, number> = {};
  for (const r of roundResults) {
    for (const res of r.results) {
      if (res.won) wins[res.playerId] = (wins[res.playerId] ?? 0) + 1;
    }
  }
  const myWins = wins[myUserId] ?? 0;
  const opponent = players.find((p) => p.id !== myUserId);
  const opWins = opponent ? (wins[opponent.id] ?? 0) : 0;
  const totalWinner = myWins > opWins ? 'me' : opWins > myWins ? 'opponent' : 'draw';

  const titleColor = totalWinner === 'me' ? 'text-success' : totalWinner === 'opponent' ? 'text-destructive' : 'text-muted-foreground';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6">
      <div className="bg-surface rounded-3xl p-6 w-[90%] max-w-md shadow-2xl">
        <h2 className={`mb-4 text-center text-xl font-extrabold ${titleColor}`}>
          {totalWinner === 'me' ? '🎉 本轮胜利！' : totalWinner === 'opponent' ? '😢 本轮落败' : '🤝 本轮平局'}
        </h2>
        <p className="mb-4 text-center text-2xl font-bold">{myWins} : {opWins}</p>

        {/* 各局结果 */}
        <div className="mb-4 space-y-2">
          {roundResults.map((r, i) => {
            const myRes = r.results.find((x) => x.playerId === myUserId);
            const opRes = r.results.find((x) => x.playerId !== myUserId);
            return (
              <div key={i} className="flex items-center justify-between rounded-xl bg-surface-container p-2 text-sm">
                <span>第 {i + 1} 局 · {MODE_LABELS[r.gameMode]}</span>
                <span>
                  {myRes?.won ? '✓ 胜' : opRes?.won ? '✗ 负' : '平'}
                  <span className="ml-2 text-muted-foreground">{Math.round((myRes?.accuracy ?? 0) * 100)}% vs {Math.round((opRes?.accuracy ?? 0) * 100)}%</span>
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button onClick={onExit} className="flex-1 rounded-xl bg-surface-container-high py-2 text-sm font-bold">退出</button>
          {canReconfigure && (
            <button onClick={onReconfigure} className="flex-1 rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground">更换游戏</button>
          )}
        </div>
      </div>
    </div>
  );
}
