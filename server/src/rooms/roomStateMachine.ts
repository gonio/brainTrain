// 房间状态机：纯函数，校验状态迁移合法性。无副作用。
import type { RoomState, Room } from '../types/room.js';

// 合法的状态迁移边
const TRANSITIONS: Record<RoomState, RoomState[]> = {
  waiting: ['ready', 'closed'],
  ready: ['waiting', 'countdown', 'closed'],
  countdown: ['ready', 'playing', 'closed'],
  playing: ['finished', 'closed'],
  finished: ['closed'],
  closed: [],
};

// 校验 fromState → toState 是否合法
export function canTransition(from: RoomState, to: RoomState): boolean {
  return TRANSITIONS[from].includes(to);
}

// 根据房间人数推断应处的"等人类"状态：
// 没人或1人 → waiting；人齐 → ready
export function nextWaitingState(room: Room): 'waiting' | 'ready' {
  return room.players.length >= room.maxPlayers ? 'ready' : 'waiting';
}
