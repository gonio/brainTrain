interface PlayerProgressProps {
  name: string;
  avatar: string;
  found: number;
  errors: number;
  target: number;
  isMe: boolean;
  done: boolean;
}

export function PlayerProgress({ name, avatar, found, errors, target, isMe, done }: PlayerProgressProps) {
  const pct = target > 0 ? Math.min(100, (found / target) * 100) : 0;
  return (
    <div className={`rounded-2xl p-3 ${isMe ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-surface-container'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{avatar}</span>
          <span className="font-bold text-sm">{isMe ? '我' : name}</span>
          {done && <span className="text-xs text-success font-bold">✓ 完成</span>}
        </div>
        <span className="text-xs text-muted-foreground">
          {found}/{target} {errors > 0 && <span className="text-destructive">×{errors}</span>}
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
