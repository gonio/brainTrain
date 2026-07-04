import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useVersusRoomStore } from '../stores/versusRoomStore';
import { connectVersus, getSocket } from '../lib/versusSocket';
import type { PublicRoom } from '../types/versus';

export function Versus() {
  const navigate = useNavigate();
  const { ensureAuthenticated } = useAuthStore();
  const { matchedRoomId } = useVersusRoomStore();
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [matchmaking, setMatchmaking] = useState(false);
  const [connected, setConnected] = useState(false);

  // 建号 + 连 socket + 订阅大厅
  useEffect(() => {
    let socket: ReturnType<typeof getSocket> = null;
    (async () => {
      await ensureAuthenticated();
      const t = useAuthStore.getState().token;
      if (!t) return;
      socket = connectVersus(t);
      setConnected(socket.connected);

      socket.on('lobby:list', setRooms);
      socket.on('lobby:roomAdded', (room: PublicRoom) => setRooms((prev) => [...prev, room]));
      socket.on('lobby:roomChanged', (room: PublicRoom) => setRooms((prev) => prev.map((r) => r.roomId === room.roomId ? room : r)));
      socket.on('lobby:roomRemoved', ({ roomId }: { roomId: string }) => setRooms((prev) => prev.filter((r) => r.roomId !== roomId)));
      socket.on('match:found', (payload) => useVersusRoomStore.getState().onMatchFound(payload));
      socket.on('connect', () => setConnected(true));
      socket.on('disconnect', () => setConnected(false));

      socket.emit('lobby:subscribe');
    })();

    return () => {
      if (socket) {
        socket.emit('lobby:unsubscribe');
        socket.off('lobby:list');
        socket.off('lobby:roomAdded');
        socket.off('lobby:roomChanged');
        socket.off('lobby:roomRemoved');
        socket.off('match:found');
      }
    };
  }, [ensureAuthenticated]);

  // 匹配成功 → 跳房间（matchedRoomId 由 socket 'match:found' handler 经 store 设置）
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

  const handleCreateRoom = () => {
    const socket = getSocket();
    if (!socket) return;
    // 建房后等服务端 room:state 推过来，房间页会接手监听
    socket.once('room:state', (payload: { roomId: string }) => {
      navigate(`/versus/room/${payload.roomId}`);
    });
    socket.emit('room:create', {});
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
        onClick={handleCreateRoom}
        disabled={!connected}
        className="w-full py-4 bg-primary text-primary-foreground font-bold text-lg rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        ＋ 创建房间
      </button>

      {/* 房间列表 */}
      <div>
        <h2 className="font-headline text-lg font-bold mb-3">公开房间</h2>
        {rooms.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">暂无公开房间，创建一个或快速匹配吧</p>
        ) : (
          <div className="space-y-2">
            {rooms.map((room) => (
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
    </div>
  );
}
