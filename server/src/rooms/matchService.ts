// 匹配队列：先到先打。第二个入队者立即与第一个配对。
import type { Player } from '../types/room.js';

export interface MatchCallbacks {
  onMatched: (a: Player, b: Player) => void;
  onTimeout: (userId: string) => void;
}

export interface MatchService {
  enqueue(userId: string, player: Player): void;
  cancel(userId: string): void;
}

export function createMatchService(
  cb: MatchCallbacks,
  opts: { timeoutMs?: number } = {},
): MatchService {
  const timeoutMs = opts.timeoutMs ?? 30000;
  // 队列：按入队顺序排
  const queue: { userId: string; player: Player }[] = [];
  const timers = new Map<string, NodeJS.Timeout>();

  function clearTimer(userId: string): void {
    const t = timers.get(userId);
    if (t) {
      clearTimeout(t);
      timers.delete(userId);
    }
  }

  function startTimer(userId: string): void {
    const t = setTimeout(() => {
      // 超时：从队列移除并通知
      removeFromQueue(userId);
      clearTimer(userId);
      cb.onTimeout(userId);
    }, timeoutMs);
    timers.set(userId, t);
  }

  function removeFromQueue(userId: string): void {
    const idx = queue.findIndex((e) => e.userId === userId);
    if (idx >= 0) queue.splice(idx, 1);
  }

  function tryMatch(): void {
    while (queue.length >= 2) {
      const a = queue.shift()!;
      const b = queue.shift()!;
      clearTimer(a.userId);
      clearTimer(b.userId);
      cb.onMatched(a.player, b.player);
    }
  }

  return {
    enqueue(userId, player) {
      // 幂等：已在队列则忽略
      if (queue.some((e) => e.userId === userId)) return;
      queue.push({ userId, player });
      startTimer(userId);
      tryMatch();
    },

    cancel(userId) {
      removeFromQueue(userId);
      clearTimer(userId);
    },
  };
}
