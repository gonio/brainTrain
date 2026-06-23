import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BottleGame } from '../../src/components/game/BottleGame';
import { countMatches, computeOptimalSwaps } from '../../src/lib/bottleUtils';

describe('countMatches', () => {
  it('完全相同返回全部匹配', () => {
    expect(countMatches(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(3);
  });

  it('完全不同返回 0', () => {
    expect(countMatches(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(0);
  });

  it('部分匹配', () => {
    expect(countMatches(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'y'])).toBe(2);
  });
});

describe('computeOptimalSwaps', () => {
  it('已匹配时最优步数为 0', () => {
    expect(computeOptimalSwaps(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(0);
  });

  it('单环（两元素互换）最优步数为 1', () => {
    // a,b,c → b,a,c：一个 2-环，n - cycles = 3 - 2 = 1
    expect(computeOptimalSwaps(['a', 'b', 'c'], ['b', 'a', 'c'])).toBe(1);
  });

  it('整体循环（3 元素一轮换）最优步数为 2', () => {
    // a,b,c → b,c,a：一个 3-环，n - cycles = 3 - 1 = 2
    expect(computeOptimalSwaps(['a', 'b', 'c'], ['b', 'c', 'a'])).toBe(2);
  });

  it('逆序 4 元素最优步数为 2（两个 2-环）', () => {
    // a,b,c,d → d,c,b,a：(a d)(b c) 两个 2-环，n - cycles = 4 - 2 = 2
    expect(computeOptimalSwaps(['a', 'b', 'c', 'd'], ['d', 'c', 'b', 'a'])).toBe(2);
  });
});

describe('BottleGame 组件', () => {
  const baseProps = {
    bottleCount: 4,
    isActive: true,
    startTime: 1000,
    onSwap: vi.fn(),
    onComplete: vi.fn(),
  };

  it('渲染上排可见瓶子 + 下排隐藏瓶子（数量 = bottleCount×2）', () => {
    render(<BottleGame {...baseProps} />);
    // 下排隐藏瓶显示「?」
    const hidden = screen.getAllByText('?');
    expect(hidden).toHaveLength(4);
    // 按钮区域（上排瓶子是可点击 div，下排无按钮）
    const gameArea = document.querySelector('.touch-none');
    expect(gameArea).not.toBeNull();
    // data-slot 数量 = bottleCount
    const slots = document.querySelectorAll('[data-slot]');
    expect(slots).toHaveLength(4);
  });

  it('点选两个瓶子触发交换（onSwap 被调用）', () => {
    const onSwap = vi.fn();
    render(<BottleGame {...baseProps} onSwap={onSwap} />);
    // jsdom 无 Pointer Capture API，手动补上避免 pointerdown 抛错
    const gameArea = document.querySelector('.touch-none') as HTMLElement;
    gameArea.setPointerCapture = vi.fn();
    gameArea.releasePointerCapture = vi.fn();

    const slots = document.querySelectorAll('[data-slot]');
    // 点第一个，再点第二个 → 交换
    fireEvent.pointerDown(slots[0], { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(slots[0], { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerDown(slots[1], { clientX: 10, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(slots[1], { clientX: 10, clientY: 0, pointerId: 1 });
    expect(onSwap).toHaveBeenCalled();
  });

  it('bottleCount=9（困难）渲染 9 个 slot', () => {
    render(<BottleGame {...baseProps} bottleCount={9} />);
    expect(document.querySelectorAll('[data-slot]')).toHaveLength(9);
    expect(screen.getAllByText('?')).toHaveLength(9);
  });
});
