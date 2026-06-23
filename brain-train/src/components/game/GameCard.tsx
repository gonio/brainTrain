import type { TrainingMode } from '../../types';

interface GameCardProps {
  title: string;
  description: string;
  mode: TrainingMode;
  priority: 'P1' | 'P2' | 'P3';
  onClick?: () => void;
  stat?: string;
  statLabel?: string;
  progress?: number;
  isLocked?: boolean;
}

const modeIcons: Record<TrainingMode, { icon: string; color: string }> = {
  schulte: { icon: 'grid_on', color: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100' },
  stroop: { icon: 'palette', color: 'bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100' },
  sequence: { icon: 'reorder', color: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100' },
  bottle: { icon: 'science', color: 'bg-amber-50 text-amber-600 group-hover:bg-amber-100' },
};

const modeColors: Record<TrainingMode, string> = {
  schulte: 'bg-indigo-600',
  stroop: 'bg-cyan-600',
  sequence: 'bg-indigo-600',
  bottle: 'bg-amber-600',
};

export function GameCard({
  title,
  description,
  mode,
  onClick,
  stat,
  statLabel,
  progress = 0,
  isLocked = false
}: GameCardProps) {
  const { icon, color } = modeIcons[mode];
  const barColor = modeColors[mode];

  if (isLocked) {
    return (
      <div className="col-span-2 bg-surface p-5 rounded-2xl editorial-shadow flex items-center gap-6 opacity-60 border border-border">
        <div className={`flex-shrink-0 w-12 h-12 ${color} rounded-xl flex items-center justify-center`}>
          <span className="material-symbols-outlined text-2xl">{icon}</span>
        </div>
        <div className="flex-grow">
          <h3 className="font-headline text-sm font-bold leading-tight mb-1 text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground font-bold mb-2">{description}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest bg-muted px-3 py-1.5 rounded-lg">Locked</p>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="bg-surface p-5 rounded-2xl editorial-shadow hover:bg-accent transition-all active:scale-95 duration-200 group text-left border border-border"
    >
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mb-4 transition-colors`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <h3 className="font-headline text-sm font-bold leading-tight mb-1 text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground font-bold mb-4">{description}</p>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.max(5, progress)}%` }}></div>
      </div>
      {stat && (
        <p className="text-xs mt-2.5 font-bold text-muted-foreground">
          {statLabel ? `${statLabel}: ` : ''}
          <span className={barColor.replace('bg-', 'text-')}>{stat}</span>
        </p>
      )}
    </button>
  );
}
