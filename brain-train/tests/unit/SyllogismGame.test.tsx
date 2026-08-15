import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyllogismGame } from '@/components/game/SyllogismGame';
import { generateSyllogismPuzzle } from '@/lib/logic/syllogismEngine';
import { mulberry32 } from './logicEngines.test';

// 组件与测试各自调一次 generateSyllogismPuzzle(3, mulberry32(42))，得到同一道题
const expected = generateSyllogismPuzzle(3, mulberry32(42)).valid;
const correctLabel = expected ? '说得通' : '说不通';
const wrongLabel = expected ? '说不通' : '说得通';

describe('SyllogismGame', () => {
  it('渲染两句前提一句结论与两个判断按钮', () => {
    render(<SyllogismGame engineLevel={3} isActive={true} rng={mulberry32(42)} onRoundEnd={() => {}} />);
    expect(screen.getByText('说得通')).toBeTruthy();
    expect(screen.getByText('说不通')).toBeTruthy();
    expect(screen.getByText(/前提/)).toBeTruthy();
    expect(screen.getByText(/结论/)).toBeTruthy();
  });

  it('答对：onRoundEnd { correct: true, attempts: 1 }，之后按钮不再响应', () => {
    const onRoundEnd = vi.fn();
    render(<SyllogismGame engineLevel={3} isActive={true} rng={mulberry32(42)} onRoundEnd={onRoundEnd} />);
    fireEvent.click(screen.getByText(correctLabel));
    expect(onRoundEnd).toHaveBeenCalledTimes(1);
    expect(onRoundEnd.mock.calls[0][0]).toEqual({ correct: true, attempts: 1 });
    fireEvent.click(screen.getByText(wrongLabel));
    expect(onRoundEnd).toHaveBeenCalledTimes(1); // 结束后忽略点击
  });

  it('3 次全错：onRoundEnd { correct: false, attempts: 3 }', () => {
    const onRoundEnd = vi.fn();
    render(<SyllogismGame engineLevel={3} isActive={true} rng={mulberry32(42)} onRoundEnd={onRoundEnd} />);
    fireEvent.click(screen.getByText(wrongLabel));
    fireEvent.click(screen.getByText(wrongLabel));
    expect(onRoundEnd).not.toHaveBeenCalled(); // 还有 1 次机会，未结束
    fireEvent.click(screen.getByText(wrongLabel));
    expect(onRoundEnd).toHaveBeenCalledTimes(1);
    expect(onRoundEnd.mock.calls[0][0]).toEqual({ correct: false, attempts: 3 });
  });
});
