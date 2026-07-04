import type { VersusPlayer } from '../../types/versus';

interface RoomHUDProps {
  roomId: string;
  players: VersusPlayer[];
  myUserId: string;
}

export function RoomHUD({ players, myUserId }: RoomHUDProps) {
  const me = players.find((p) => p.id === myUserId);
  const opponent = players.find((p) => p.id !== myUserId);
  return (
    <div className="flex items-center justify-between bg-surface-container rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <span className="text-3xl">{me?.avatar}</span>
        <div>
          <div className="font-bold text-sm">{me?.name}</div>
          <div className="text-xs text-success">{me?.ready ? '已准备' : '未准备'}</div>
        </div>
      </div>
      <span className="material-symbols-outlined text-2xl text-muted-foreground">swords</span>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="font-bold text-sm">{opponent?.name ?? '等待中…'}</div>
          <div className="text-xs text-muted-foreground">{opponent?.ready ? '已准备' : '未准备'}</div>
        </div>
        <span className="text-3xl">{opponent?.avatar ?? '❓'}</span>
      </div>
    </div>
  );
}
