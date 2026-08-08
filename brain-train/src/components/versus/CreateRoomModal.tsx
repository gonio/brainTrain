import { useState } from 'react';
import type { RoundMode, GameMode } from '@/types/versus';

const GAME_OPTIONS: { mode: GameMode; label: string; icon: string }[] = [
  { mode: 'schulte', label: '舒尔特表', icon: '🔢' },
  { mode: 'stroop', label: '字色干扰', icon: '🎨' },
  { mode: 'sequence', label: '序列记忆', icon: '🧩' },
  { mode: 'bottle', label: '暗瓶排列', icon: '🍾' },
];

interface CreateRoomModalProps {
  onConfirm: (roundMode: RoundMode, games: GameMode[]) => void;
  onCancel: () => void;
}

export function CreateRoomModal({ onConfirm, onCancel }: CreateRoomModalProps) {
  const [roundMode, setRoundMode] = useState<RoundMode>('single');
  const [selected, setSelected] = useState<GameMode[]>(['schulte']);

  const toggleGame = (mode: GameMode) => {
    setSelected((prev) => {
      if (roundMode === 'single') return [mode];  // 单局只能选一个
      if (prev.includes(mode)) return prev.filter((g) => g !== mode);
      if (prev.length >= 4) return prev;  // 多局最多 4 个
      return [...prev, mode];
    });
  };

  const switchMode = (mode: RoundMode) => {
    setRoundMode(mode);
    if (mode === 'single') setSelected(selected.length > 0 ? [selected[0]] : ['schulte']);
  };

  const canConfirm = roundMode === 'single' ? selected.length === 1 : selected.length >= 2 && selected.length <= 4;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="w-[90%] max-w-md rounded-2xl bg-white p-6 dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold">创建对战房间</h2>

        {/* 对局模式 */}
        <div className="mb-4">
          <p className="mb-2 text-sm text-gray-500">对局模式</p>
          <div className="flex gap-2">
            <button
              onClick={() => switchMode('single')}
              className={`flex-1 rounded-lg py-2 text-sm ${roundMode === 'single' ? 'bg-indigo-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
            >
              单局
            </button>
            <button
              onClick={() => switchMode('multi')}
              className={`flex-1 rounded-lg py-2 text-sm ${roundMode === 'multi' ? 'bg-indigo-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
            >
              多局（2-4 种）
            </button>
          </div>
        </div>

        {/* 游戏选择 */}
        <div className="mb-4">
          <p className="mb-2 text-sm text-gray-500">
            选择游戏{roundMode === 'multi' ? `（已选 ${selected.length}/4，按选择顺序对战）` : ''}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {GAME_OPTIONS.map((g) => {
              const idx = selected.indexOf(g.mode);
              const isSelected = idx >= 0;
              return (
                <button
                  key={g.mode}
                  onClick={() => toggleGame(g.mode)}
                  className={`relative rounded-lg p-3 text-left ${isSelected ? 'bg-indigo-100 ring-2 ring-indigo-500 dark:bg-indigo-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}
                >
                  <span className="text-2xl">{g.icon}</span>
                  <span className="block text-sm font-medium">{g.label}</span>
                  {isSelected && roundMode === 'multi' && (
                    <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-xs text-white">{idx + 1}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-lg bg-gray-200 py-2 text-sm dark:bg-gray-600">取消</button>
          <button
            disabled={!canConfirm}
            onClick={() => onConfirm(roundMode, selected)}
            className="flex-1 rounded-lg bg-indigo-500 py-2 text-sm text-white disabled:opacity-40"
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
