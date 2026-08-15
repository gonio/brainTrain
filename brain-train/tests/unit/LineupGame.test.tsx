import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LineupGame } from '@/components/game/LineupGame';
import { generateLineupPuzzle } from '@/lib/logic/lineupEngine';
import { mulberry32 } from '@/lib/rng';

// 组件与测试各自调一次 generateLineupPuzzle(3, mulberry32(seed))，得到同一道题
// （level 3：seed 7 → whoAt 第 2 位是谁；seed 1 → whereIs 小李在第几位）
const whoAtPuzzle = generateLineupPuzzle(3, mulberry32(7));
const whereIsPuzzle = generateLineupPuzzle(3, mulberry32(1));
if (whoAtPuzzle.question.kind !== 'whoAt') throw new Error('seed 7 应生成 whoAt 题');
if (whereIsPuzzle.question.kind !== 'whereIs') throw new Error('seed 1 应生成 whereIs 题');

describe('LineupGame', () => {
  it('渲染线索列表、问题与选项 chips', () => {
    render(
      <LineupGame engineLevel={3} isActive={true} rng={mulberry32(7)} onRoundEnd={() => {}} />,
    );
    // 线索逐条渲染；whoAt 问题的选项 = 全部人名 chips
    expect(screen.getAllByRole('listitem').length).toBe(whoAtPuzzle.clues.length);
    expect(screen.getByText('第 2 位是谁？')).toBeTruthy();
    whoAtPuzzle.people.forEach((name) => {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    });
  });

  it('whoAt：点中正确人名，一次作答上抛', () => {
    const onRoundEnd = vi.fn();
    render(
      <LineupGame engineLevel={3} isActive={true} rng={mulberry32(7)} onRoundEnd={onRoundEnd} />,
    );
    const q = whoAtPuzzle.question; // 已断言 kind === 'whoAt'
    if (q.kind !== 'whoAt') return;
    const answer = whoAtPuzzle.people[whoAtPuzzle.solution[q.pos - 1]];
    fireEvent.click(screen.getByRole('button', { name: answer }));
    expect(onRoundEnd).toHaveBeenCalledTimes(1);
    expect(onRoundEnd.mock.calls[0][0]).toEqual({ correct: true, attempts: 1 });
  });

  it('whereIs：点中正确位置号，一次作答上抛', () => {
    const onRoundEnd = vi.fn();
    render(
      <LineupGame engineLevel={3} isActive={true} rng={mulberry32(1)} onRoundEnd={onRoundEnd} />,
    );
    const q = whereIsPuzzle.question; // 已断言 kind === 'whereIs'
    if (q.kind !== 'whereIs') return;
    expect(screen.getByText(`${whereIsPuzzle.people[q.person]} 在第几位？`)).toBeTruthy();
    const answer = String(whereIsPuzzle.solution.indexOf(q.person) + 1);
    fireEvent.click(screen.getByRole('button', { name: answer }));
    expect(onRoundEnd).toHaveBeenCalledTimes(1);
    expect(onRoundEnd.mock.calls[0][0]).toEqual({ correct: true, attempts: 1 });
  });
});
