import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useVersusRoomStore } from '../stores/versusRoomStore';
import { initVersusSession } from '../lib/versusSocketSession';
import { getSocket } from '../lib/versusSocket';
import { VersusSchulteBoard, PlayerProgress, RoomHUD, CountdownOverlay, VersusResultDialog } from '../components/versus';

export function VersusRoom() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    view, room, countdown, gameData, progress, endResult, error, reset,
  } = useVersusRoomStore();

  // 确保 socket 会话已初始化
  // 注意：不在 cleanup 里发 room:leave——AnimatePresence 过渡会触发短暂的
  // 挂载/卸载，cleanup 立即 leave 会把刚建的房间销毁。离开房间靠：
  // 1. 用户点"离开房间"按钮（handleExit 显式 emit）
  // 2. 后端容错（建房/加入/匹配时清理残留房间）
  useEffect(() => {
    initVersusSession();
  }, []);

  const myUserId = user?.id ?? '';
  const me = room?.players.find((p) => p.id === myUserId);
  const opponent = room?.players.find((p) => p.id !== myUserId);
  const isHost = me?.isHost ?? false;
  const allReady = room?.players.every((p) => p.ready) ?? false;
  const isFull = (room?.players.length ?? 0) >= 2;

  const handleToggleReady = () => {
    getSocket()?.emit('player:ready', { ready: !me?.ready });
  };

  const handleStart = () => {
    getSocket()?.emit('room:start');
  };

  const handleTap = (cellIndex: number) => {
    getSocket()?.emit('game:tap', { cellIndex });
  };

  const handlePlayAgain = () => {
    // 再来一局：离开当前房间，回大厅
    getSocket()?.emit('room:leave');
    reset();
    navigate('/versus');
  };

  const handleExit = () => {
    getSocket()?.emit('room:leave');
    reset();
    navigate('/versus');
  };

  // ===== 按 view 分发渲染 =====

  if (view === 'result' && endResult) {
    return <VersusResultDialog result={endResult} onPlayAgain={handlePlayAgain} onExit={handleExit} />;
  }

  if (view === 'playing' && gameData) {
    const myProg = progress?.me ?? { found: 0, errors: 0, done: false };
    const opProg = progress?.opponent ?? { found: 0, errors: 0, done: false };
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <PlayerProgress
            name={me?.name ?? '我'} avatar={me?.avatar ?? '❓'}
            found={myProg.found} errors={myProg.errors} target={gameData.target}
            isMe done={myProg.done}
          />
          <PlayerProgress
            name={opponent?.name ?? '对手'} avatar={opponent?.avatar ?? '❓'}
            found={opProg.found} errors={opProg.errors} target={gameData.target}
            isMe={false} done={opProg.done}
          />
        </div>
        <VersusSchulteBoard grid={gameData.grid} size={gameData.size} onTap={handleTap} />
      </div>
    );
  }

  // view === 'ready' 或 'countdown'（countdown 时仍显示房间界面 + 遮罩）
  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-xl text-sm">{error}</div>
      )}

      {room && <RoomHUD roomId={room.roomId} players={room.players} myUserId={myUserId} />}

      {/* 玩法规则 */}
      <div className="bg-accent/50 rounded-2xl p-4 space-y-2">
        <h3 className="font-headline font-bold text-base flex items-center gap-2">
          <span className="material-symbols-outlined text-xl">info</span>
          舒尔特对战 · 玩法说明
        </h3>
        <ul className="text-sm text-muted-foreground space-y-1 leading-relaxed">
          <li>• 5×5 舒尔特表，数字 1~25 随机排列</li>
          <li>• <strong>从 1 到 25 按顺序点击</strong>（正序）</li>
          <li>• 先点完所有数字的一方获胜</li>
          <li>• 点错会降低正确率，正确率相同时比拼速度</li>
          <li>• 限时 90 秒，未点完按当前进度结算</li>
        </ul>
      </div>

      <div className="text-center py-4">
        <p className="text-muted-foreground">
          {isFull ? (allReady ? '房主可以开始游戏了' : '等待所有玩家准备…') : '等待对手加入…'}
        </p>
      </div>

      {/* 准备/开始按钮 */}
      <div className="space-y-3">
        {!isHost && (
          <button
            onClick={handleToggleReady}
            className={`w-full py-4 font-bold text-lg rounded-2xl transition-opacity ${
              me?.ready ? 'bg-success text-success-foreground' : 'bg-primary text-primary-foreground'
            }`}
          >
            {me?.ready ? '✓ 已准备（点击取消）' : '准备'}
          </button>
        )}
        {isHost && (
          <button
            onClick={handleStart}
            disabled={!isFull || !allReady}
            className="w-full py-4 bg-primary text-primary-foreground font-bold text-lg rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isFull && allReady ? '开始游戏' : '等待准备…'}
          </button>
        )}
        <button
          onClick={handleExit}
          className="w-full py-3 bg-surface-container text-foreground font-bold rounded-2xl hover:bg-surface-container-high transition-colors"
        >
          离开房间
        </button>
      </div>

      <CountdownOverlay remaining={countdown} />
    </div>
  );
}
