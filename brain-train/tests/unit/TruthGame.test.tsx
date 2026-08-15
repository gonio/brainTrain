import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TruthGame } from '@/components/game/TruthGame';
import { generateTruthPuzzle } from '@/lib/logic/truthEngine';
import { mulberry32 } from '@/lib/rng';

// 组件与测试各自调一次 generateTruthPuzzle(3, mulberry32(7))，得到同一道题（答案 [true,false,true]）
const expected = generateTruthPuzzle(3, mulberry32(7)).knight;

describe('TruthGame', () => {
  it('渲染每人一句陈述与身份切换', () => {
    render(<TruthGame engineLevel={3} isActive={true} rng={mulberry32(7)} onRoundEnd={() => {}} />);
    // 3 人岛：3 条陈述 + 每人一个骑士/无赖切换 + 提交按钮
    expect(screen.getAllByRole('button', { name: /骑士|无赖/ }).length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('提交答案')).toBeTruthy();
  });
  it('提交后回调一次作答结果', () => {
    const onRoundEnd = vi.fn();
    render(<TruthGame engineLevel={3} isActive={true} rng={mulberry32(7)} onRoundEnd={onRoundEnd} />);
    // 初始全骑士，把谜底为无赖的人拨到「无赖」，使本次提交必对
    const knaveButtons = screen.getAllByRole('button', { name: '无赖' });
    expected.forEach((isKnight, i) => {
      if (!isKnight) fireEvent.click(knaveButtons[i]);
    });
    fireEvent.click(screen.getByText('提交答案'));
    expect(onRoundEnd).toHaveBeenCalledTimes(1);
    expect(onRoundEnd.mock.calls[0][0].attempts).toBe(1);
  });
});
