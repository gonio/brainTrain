interface PlayerProgressProps {
  name: string;
  avatar: string;
  percent: number;      // 0-100
  done: boolean;
  isMe: boolean;
}

export function PlayerProgress({ name, avatar, percent, done, isMe }: PlayerProgressProps) {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div className={`rounded-2xl p-3 ${isMe ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-surface-container'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{avatar}</span>
          <span className="font-bold text-sm">{isMe ? '我' : name}</span>
          {done && <span className="text-xs text-success font-bold">✓ 完成</span>}
        </div>
        <span className="text-xs text-muted-foreground">
          {done ? '完成' : `${Math.round(pct)}%`}
        </span>
      </div>
      <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${isMe ? 'bg-primary' : 'bg-secondary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
