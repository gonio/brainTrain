interface ScoreBoardProps {
  score: number;
  accuracy?: number;
  streak?: number;
  label?: string;
}

export function ScoreBoard({ score, accuracy, streak, label = '得分' }: ScoreBoardProps) {
  return (
    <div className="flex items-center gap-4 p-4 bg-accent rounded-lg">
      <div className="text-center">
        <div className="text-3xl font-bold text-primary">{score.toLocaleString()}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>

      {accuracy !== undefined && (
        <div className="text-center px-4 border-l">
          <div className="text-3xl font-bold text-primary">{Math.round(accuracy)}%</div>
          <div className="text-xs text-muted-foreground">准确率</div>
        </div>
      )}

      {streak !== undefined && streak > 0 && (
        <div className="text-center px-4 border-l">
          <div className="text-3xl font-bold text-orange-500">{streak}</div>
          <div className="text-xs text-muted-foreground">连击</div>
        </div>
      )}
    </div>
  );
}
