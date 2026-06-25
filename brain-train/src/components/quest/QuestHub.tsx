// 关卡大厅：4 游戏进度总览 + 开始下一关 / 返回
import type { QuestProgress, GameId } from '@/types/quest';
import { GAME_IDS } from '@/types/quest';

const GAME_NAMES: Record<GameId, string> = {
  schulte: '舒尔特表',
  sequence: '序列记忆',
  stroop: '字色干扰',
  bottle: '暗瓶排列',
};

interface QuestHubProps {
  progress: QuestProgress;
  onStart: () => void;
  onBack: () => void;
}

export function QuestHub({ progress, onStart, onBack }: QuestHubProps) {
  const totalCleared = GAME_IDS.reduce((sum, g) => sum + progress.progress[g], 0);
  const totalStars = Object.values(progress.stars).reduce<number>((sum, s) => sum + s, 0);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-headline text-3xl font-extrabold text-foreground">主线闯关</h1>
          <p className="text-muted-foreground text-sm mt-1">
            已完成 {totalCleared}/40 关 · 累计 {totalStars} 星
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors"
        >
          返回
        </button>
      </div>

      {/* 4 游戏进度 */}
      <div className="space-y-4 mb-8">
        {GAME_IDS.map((g) => {
          const cleared = progress.progress[g];
          return (
            <div key={g} className="bg-surface-container rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-foreground">{GAME_NAMES[g]}</span>
                <span className="text-sm text-muted-foreground">{cleared}/10</span>
              </div>
              <div className="h-2 bg-accent rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(cleared / 10) * 100}%` }}
                />
              </div>
              {/* 已通过关卡的星级（每关最多 3 星） */}
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-2 text-xs">
                {Array.from({ length: 10 }, (_, i) => {
                  const stars = progress.stars[`${g}-${i + 1}`] ?? 0;
                  return (
                    <span key={i} className={stars > 0 ? 'text-yellow-500' : 'text-muted-foreground/40'}>
                      {stars > 0 ? '★'.repeat(stars) : '·'}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {progress.completed ? (
        <div className="text-center py-8">
          <p className="text-2xl font-headline font-bold text-success mb-2">🎉 全部通关！</p>
          <p className="text-muted-foreground">共 {totalStars} 颗星</p>
        </div>
      ) : (
        <button
          onClick={onStart}
          className="w-full py-4 bg-primary text-primary-foreground font-bold text-lg rounded-2xl hover:opacity-90 transition-opacity"
        >
          开始下一关
        </button>
      )}
    </div>
  );
}
