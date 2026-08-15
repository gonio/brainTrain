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
    // 必须逐人显式选择身份才能提交；按谜底拨好，使本次提交必对
    const knightButtons = screen.getAllByRole('button', { name: '骑士' });
    const knaveButtons = screen.getAllByRole('button', { name: '无赖' });
    expected.forEach((isKnight, i) => {
      fireEvent.click(isKnight ? knightButtons[i] : knaveButtons[i]);
    });
    fireEvent.click(screen.getByText('提交答案'));
    expect(onRoundEnd).toHaveBeenCalledTimes(1);
    expect(onRoundEnd.mock.calls[0][0].attempts).toBe(1);
  });
  it('未选完全员身份前提交按钮禁用', () => {
    const onRoundEnd = vi.fn();
    render(<TruthGame engineLevel={3} isActive={true} rng={mulberry32(7)} onRoundEnd={onRoundEnd} />);
    // 初始所有人未选：禁用
    expect(screen.getByText('提交答案')).toBeDisabled();
    // 只选了一部分：仍禁用，点击也不产生任何回调
    fireEvent.click(screen.getAllByRole('button', { name: '骑士' })[0]);
    expect(screen.getByText('提交答案')).toBeDisabled();
    fireEvent.click(screen.getByText('提交答案'));
    expect(onRoundEnd).not.toHaveBeenCalled();
  });
  it('全骑士谜底也必须显式选择才能提交（防盲点白嫖回归）', () => {
    const onRoundEnd = vi.fn();
    // seed 66 → 3 人岛谜底全骑士：旧版初始全当骑士时，盲点提交答案直接命中 3 星
    expect(generateTruthPuzzle(3, mulberry32(66)).knight).toEqual([true, true, true]);
    render(<TruthGame engineLevel={3} isActive={true} rng={mulberry32(66)} onRoundEnd={onRoundEnd} />);
    const submit = screen.getByText('提交答案');
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(onRoundEnd).not.toHaveBeenCalled();
  });
});
