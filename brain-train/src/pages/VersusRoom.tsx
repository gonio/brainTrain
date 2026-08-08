import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useVersusRoomStore } from '../stores/versusRoomStore';
import { initVersusSession } from '../lib/versusSocketSession';
import { getSocket } from '../lib/versusSocket';
import { gameplayInstructionsMap } from '../lib/gameplayInstructions';
import {
  VersusSchulteBoard, VersusStroopBoard, VersusSequenceBoard, VersusBottleBoard,
  PlayerProgress, RoomHUD, CountdownOverlay, VersusResultDialog, RoundResultDialog,
  CreateRoomModal,
} from '../components/versus';
import type { GameMode, RoundMode } from '../types/versus';

const MODE_LABELS: Record<GameMode, string> = {
  schulte: '舒尔特',
  stroop: '字色',
  sequence: '序列',
  bottle: '暗瓶',
};

export function VersusRoom() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    view, room, countdown, gameData, progress, endResult, error, reset,
    roundInfo, roundResults, graceSeconds,
  } = useVersusRoomStore();

  const [showReconfigure, setShowReconfigure] = useState(false);

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

  // 单局结束后的「再来一局」/「下一局」：
  // 保持现有逻辑（setView('ready') + 清游戏状态），因为多局推进由服务端
  // room:nextRound 事件驱动，单局则等房主重新开始。这里只负责把本地视图
  // 切回 ready，不额外 emit。
  const handlePlayAgain = () => {
    useVersusRoomStore.getState().setView('ready');
    useVersusRoomStore.setState({ endResult: null, gameData: null, progress: null, countdown: null, graceSeconds: null });
  };

  const handleReconfigure = (roundMode: RoundMode, games: GameMode[]) => {
    getSocket()?.emit('room:reconfigure', { roundMode, games });
    setShowReconfigure(false);
  };

  const handleExit = () => {
    getSocket()?.emit('room:leave');
    reset();
    navigate('/versus');
  };

  // ===== 按 gameMode 分派棋盘 =====
  const renderBoard = () => {
    if (!gameData) return null;
    const seed = gameData.seed;
    const handleAction = (payload: unknown) => {
      getSocket()?.emit('game:action', { mode: gameData.mode, payload });
    };

    if (seed.mode === 'schulte') {
      return (
        <VersusSchulteBoard
          grid={seed.grid}
          size={seed.size}
          order={seed.order}
          direction={seed.direction}
          onTap={(i) => handleAction({ cellIndex: i })}
        />
      );
    }
    if (seed.mode === 'stroop') {
      return (
        <VersusStroopBoard
          questions={seed.questions}
          timePerQuestionSec={seed.timePerQuestionSec}
          onAnswer={(qi, ans) => handleAction({ questionIndex: qi, answer: ans })}
        />
      );
    }
    if (seed.mode === 'sequence') {
      return (
        <VersusSequenceBoard
          sequence={seed.sequence}
          optionPool={seed.optionPool}
          memorizeMs={seed.memorizeMs}
          recallTimeLimitMs={seed.recallTimeLimitMs}
          onSubmit={(us) => handleAction({ userSequence: us })}
        />
      );
    }
    if (seed.mode === 'bottle') {
      return (
        <VersusBottleBoard
          targetSequence={seed.targetSequence}
          initialSequence={seed.initialSequence}
          onSwap={(ps) => handleAction({ playerSequence: ps })}
        />
      );
    }
    return null;
  };

  // ===== 按 view 分发渲染 =====

  // 本轮全部结束：多局总结算
  if (view === 'roundResult' && room) {
    return (
      <RoundResultDialog
        roundResults={roundResults}
        players={room.players}
        myUserId={myUserId}
        onReconfigure={() => setShowReconfigure(true)}
        onExit={handleExit}
        canReconfigure={!!roundInfo?.hostCanChangeGames && isHost}
      />
    );
  }

  // 单局结束
  if (view === 'result' && endResult) {
    // 多局模式且还有下一局 → 「下一局」，否则「再来一局」
    const hasNext = roundInfo ? roundInfo.currentQueueIndex + 1 < roundInfo.totalInRound : false;
    return (
      <VersusResultDialog
        result={endResult}
        mode={gameData?.mode ?? 'schulte'}
        detail={endResult.detail}
        onPlayAgain={handlePlayAgain}
        onExit={handleExit}
        playAgainLabel={hasNext ? '下一局' : '再来一局'}
      />
    );
  }

  // 对局进行中
  if (view === 'playing' && gameData) {
    const myProg = progress?.me ?? { percent: 0, done: false };
    const opProg = progress?.opponent ?? { percent: 0, done: false };
    return (
      <div className="space-y-4">
        {/* 多局队列提示 */}
        {roundInfo && roundInfo.roundMode === 'multi' && (
          <div className="text-center text-sm text-muted-foreground">
            第 {roundInfo.currentQueueIndex + 1}/{roundInfo.totalInRound} 局 · {MODE_LABELS[gameData.mode]}
          </div>
        )}

        <div className="space-y-2">
          <PlayerProgress
            name={me?.name ?? '我'} avatar={me?.avatar ?? '❓'}
            percent={myProg.percent} done={myProg.done}
            isMe
          />
          <PlayerProgress
            name={opponent?.name ?? '对手'} avatar={opponent?.avatar ?? '❓'}
            percent={opProg.percent} done={opProg.done}
            isMe={false}
          />
        </div>

        {/* grace 倒计时（字色先完成者触发对方宽限） */}
        {graceSeconds !== null && (
          <div className="rounded-xl bg-destructive/10 p-3 text-center text-sm text-destructive">
            对手已完成 · 剩余 {graceSeconds}s
          </div>
        )}

        {renderBoard()}
      </div>
    );
  }

  // view === 'ready' 或 'countdown'（countdown 时仍显示房间界面 + 遮罩）
  const currentMode = (room?.gameMode ?? 'schulte') as GameMode;
  const instructions = gameplayInstructionsMap[currentMode];
  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-xl text-sm">{error}</div>
      )}

      {room && <RoomHUD roomId={room.roomId} players={room.players} myUserId={myUserId} />}

      {/* 本轮队列进度 + 更换游戏（房主 + hostCanChangeGames） */}
      {roundInfo && (
        <div className="text-sm text-muted-foreground flex items-center">
          {roundInfo.roundMode === 'multi'
            ? `多局对战 · 第 ${roundInfo.currentQueueIndex + 1}/${roundInfo.totalInRound} 局`
            : '单局对战'}
          {roundInfo.hostCanChangeGames && isHost && (
            <button onClick={() => setShowReconfigure(true)} className="ml-2 text-primary hover:underline">更换游戏</button>
          )}
        </div>
      )}

      {/* 玩法规则（根据当前 gameMode） */}
      {instructions && (
        <div className="bg-accent/50 rounded-2xl p-4 space-y-2">
          <h3 className="font-headline font-bold text-base flex items-center gap-2">
            <span className="material-symbols-outlined text-xl">info</span>
            {instructions.title} · 玩法说明
          </h3>
          <ul className="text-sm text-muted-foreground space-y-1 leading-relaxed">
            {instructions.howToPlay.map((line, i) => (
              <li key={i}>• {line}</li>
            ))}
          </ul>
        </div>
      )}

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

      {showReconfigure && (
        <CreateRoomModal onConfirm={handleReconfigure} onCancel={() => setShowReconfigure(false)} />
      )}
    </div>
  );
}
