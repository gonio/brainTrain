import { describe, it, expect } from 'vitest';
import { canTransition, nextWaitingState } from '../src/rooms/roomStateMachine.js';
import type { Room } from '../src/types/room.js';

describe('roomStateMachine', () => {
  describe('canTransition', () => {
    it('waiting → ready 合法（第二人加入）', () => {
      expect(canTransition('waiting', 'ready')).toBe(true);
    });

    it('ready → waiting 合法（有人离开）', () => {
      expect(canTransition('ready', 'waiting')).toBe(true);
    });

    it('ready → countdown 合法（房主开始）', () => {
      expect(canTransition('ready', 'countdown')).toBe(true);
    });

    it('countdown → ready 合法（计划二占位：倒计时结束回 ready）', () => {
      expect(canTransition('countdown', 'ready')).toBe(true);
    });

    it('countdown → playing 合法（计划三会启用）', () => {
      expect(canTransition('countdown', 'playing')).toBe(true);
    });

    it('playing → finished 合法', () => {
      expect(canTransition('playing', 'finished')).toBe(true);
    });

    it('finished → ready 合法（裁定完重开）', () => {
      expect(canTransition('finished', 'ready')).toBe(true);
    });

    it('finished → waiting 合法（裁定完重开）', () => {
      expect(canTransition('finished', 'waiting')).toBe(true);
    });

    it('任意 → closed 合法（销毁）', () => {
      expect(canTransition('waiting', 'closed')).toBe(true);
      expect(canTransition('playing', 'closed')).toBe(true);
      expect(canTransition('finished', 'closed')).toBe(true);
    });

    it('waiting → playing 非法（必须经 ready/countdown）', () => {
      expect(canTransition('waiting', 'playing')).toBe(false);
    });

    it('playing → waiting 非法（不能从对战跳回等人）', () => {
      expect(canTransition('playing', 'waiting')).toBe(false);
    });

    it('closed → 任意 非法（终态）', () => {
      expect(canTransition('closed', 'waiting')).toBe(false);
      expect(canTransition('closed', 'ready')).toBe(false);
    });
  });

  describe('nextWaitingState', () => {
    const baseRoom = (playerCount: number): Room => ({
      roomId: 'r1', name: '测试房', hostId: 'h1',
      state: 'waiting', gameMode: 'schulte', maxPlayers: 2,
      createdAt: 0,
      players: Array.from({ length: playerCount }, (_, i) => ({
        id: `p${i}`, socketId: `s${i}`, name: `玩家${i}`,
        avatar: '🦊', ready: playerCount === 2, isHost: i === 0, connected: true,
      })),
    });

    it('1 人 → waiting', () => {
      expect(nextWaitingState(baseRoom(1))).toBe('waiting');
    });

    it('2 人 → ready', () => {
      expect(nextWaitingState(baseRoom(2))).toBe('ready');
    });

    it('0 人 → waiting', () => {
      expect(nextWaitingState(baseRoom(0))).toBe('waiting');
    });
  });
});
