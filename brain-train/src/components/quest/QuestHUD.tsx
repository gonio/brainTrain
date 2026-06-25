// 主线闯关进行中顶部条：游戏名 + 难度 + 退出
import type { GameId } from '@/types/quest';

const GAME_NAMES: Record<GameId, string> = {
  schulte: '舒尔特表',
  sequence: '序列记忆',
  stroop: '字色干扰',
  bottle: '暗瓶排列',
};

interface QuestHUDProps {
  gameId: GameId;
  difficulty: number;
  onExit: () => void;
}

export function QuestHUD({ gameId, difficulty, onExit }: QuestHUDProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-surface-container rounded-2xl mb-4">
      <div className="flex items-center gap-3">
        <span className="font-headline font-bold text-foreground">{GAME_NAMES[gameId]}</span>
        <span className="text-sm text-muted-foreground">难度 {difficulty} / 10</span>
      </div>
      <button
        onClick={onExit}
        className="px-3 py-1.5 text-sm rounded-lg bg-surface hover:bg-surface-container-high transition-colors"
      >
        退出
      </button>
    </div>
  );
}
