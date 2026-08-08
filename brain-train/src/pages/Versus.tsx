import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVersusRoomStore } from '../stores/versusRoomStore';
import { initVersusSession, subscribeLobby, unsubscribeLobby } from '../lib/versusSocketSession';
import { getSocket } from '../lib/versusSocket';
import { CreateRoomModal } from '@/components/versus';
import type { RoundMode, GameMode } from '@/types/versus';

export function Versus() {
  const navigate = useNavigate();
  const { matchedRoomId, lobbyRooms, connected } = useVersusRoomStore();
  const [matchmaking, setMatchmaking] = useMatchmaking();
  const [showCreate, setShowCreate] = useState(false);

  // 初始化 socket 会话（幂等，只建一次 listener）+ 订阅大厅
  useEffect(() => {
    let socket: ReturnType<typeof getSocket> | null = null;
    (async () => {
      socket = await initVersusSession();
      if (!socket) return;
      useVersusRoomStore.getState().setConnected(socket.connected);
      socket.on('connect', () => useVersusRoomStore.getState().setConnected(true));
      socket.on('disconnect', () => useVersusRoomStore.getState().setConnected(false));
      subscribeLobby();
    })();

    return () => {
      // 离开大厅页只退订大厅广播，不移除 socket listener（session 持续）
      unsubscribeLobby();
    };
  }, []);

  // 匹配成功 → 跳房间
  useEffect(() => {
    if (matchedRoomId) {
      navigate(`/versus/room/${matchedRoomId}`);
    }
  }, [matchedRoomId, navigate]);

  const handleQuickMatch = () => {
    const socket = getSocket();
    if (!socket) return;
    setMatchmaking(true);
    socket.on('match:found', () => setMatchmaking(false));
    socket.on('match:timeout', () => setMatchmaking(false));
    socket.emit('match:queue');
  };

  const handleCancelMatch = () => {
    getSocket()?.emit('match:cancel');
    setMatchmaking(false);
  };

  const handleCreateConfirm = (roundMode: RoundMode, games: GameMode[]) => {
    const socket = getSocket();
    if (!socket) return;
    socket.once('room:state', (payload: { roomId: string }) => {
      navigate(`/versus/room/${payload.roomId}`);
    });
    socket.emit('room:create', { roundMode, games });
    setShowCreate(false);
  };

  const handleJoinRoom = (roomId: string) => {
    const socket = getSocket();
    if (!socket) return;
    socket.once('room:state', (payload: { roomId: string }) => {
      navigate(`/versus/room/${payload.roomId}`);
    });
    socket.emit('room:join', { roomId });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-2xl font-extrabold">多人大厅</h1>
        <span className={`text-xs ${connected ? 'text-success' : 'text-muted-foreground'}`}>
          {connected ? '● 已连接' : '○ 连接中…'}
        </span>
      </div>

      {/* 快速匹配 */}
      <button
        onClick={matchmaking ? handleCancelMatch : handleQuickMatch}
        disabled={!connected}
        className={`w-full py-4 font-bold text-lg rounded-2xl transition-opacity disabled:opacity-50 ${
          matchmaking ? 'bg-destructive text-destructive-foreground' : 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
        }`}
      >
        {matchmaking ? '取消匹配…' : '⚡ 快速匹配'}
      </button>

      {/* 创建房间 */}
      <button
        onClick={() => setShowCreate(true)}
        disabled={!connected}
        className="w-full py-4 bg-primary text-primary-foreground font-bold text-lg rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        ＋ 创建房间
      </button>

      {/* 房间列表 */}
      <div>
        <h2 className="font-headline text-lg font-bold mb-3">公开房间</h2>
        {lobbyRooms.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">暂无公开房间，创建一个或快速匹配吧</p>
        ) : (
          <div className="space-y-2">
            {lobbyRooms.map((room) => (
              <button
                key={room.roomId}
                onClick={() => handleJoinRoom(room.roomId)}
                disabled={room.playerCount >= 2}
                className="w-full flex items-center justify-between p-4 bg-surface-container rounded-2xl hover:bg-surface-container-high transition-colors disabled:opacity-50 text-left"
              >
                <div>
                  <div className="font-bold">{room.name}</div>
                  <div className="text-xs text-muted-foreground">房主：{room.hostName}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${room.playerCount >= 2 ? 'text-muted-foreground' : 'text-success'}`}>
                    {room.playerCount}/2
                  </span>
                  <span className="material-symbols-outlined">chevron_right</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateRoomModal onConfirm={handleCreateConfirm} onCancel={() => setShowCreate(false)} />}
    </div>
  );
}

// 简单的本地匹配状态 hook
function useMatchmaking(): [boolean, (v: boolean) => void] {
  return useState(false);
}
