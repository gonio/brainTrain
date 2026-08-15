import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ZebraGame } from '@/components/game/ZebraGame';
import { generateZebraPuzzle } from '@/lib/logic/zebraEngine';
import { expectedZebraAnswer } from '@/lib/logic/zebraText';
import { mulberry32 } from '@/lib/rng';

// 组件与测试各自调一次 generateZebraPuzzle(3, mulberry32(7))，得到同一道题
// （level 3、seed 7 → whoHasPet「谁养猫？」，期望答案 小张）
const puzzle = generateZebraPuzzle(3, mulberry32(7));
if (puzzle.question.kind !== 'whoHasPet') throw new Error('seed 7 应生成 whoHasPet 题');

describe('expectedZebraAnswer', () => {
  it('答案非空且属于该问法的选项集', () => {
    // 扫多个难度 × seed（3 座与 4 座房），覆盖三种问法
    for (const level of [3, 12]) {
      for (let seed = 1; seed <= 5; seed++) {
        const p = generateZebraPuzzle(level, mulberry32(seed));
        const ans = expectedZebraAnswer(p);
        expect(ans.length).toBeGreaterThan(0);
        const optionSet =
          p.question.kind === 'whatAtHouse'
            ? p.question.attr === 'pet'
              ? p.pets
              : p.drinks
            : p.people;
        expect(optionSet).toContain(ans);
      }
    }
  });
});

describe('ZebraGame', () => {
  it('渲染属性栏、线索列表、问题与选项 chips', () => {
    render(
      <ZebraGame engineLevel={3} isActive={true} rng={mulberry32(7)} onRoundEnd={() => {}} />,
    );
    // 线索逐条渲染；whoHasPet 问题的选项 = 全部人名 chips
    expect(screen.getAllByRole('listitem').length).toBe(puzzle.clues.length);
    expect(screen.getByText('谁养猫？')).toBeTruthy();
    puzzle.people.forEach((name) => {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    });
  });

  it('点中期望答案，一次作答上抛', () => {
    const onRoundEnd = vi.fn();
    render(
      <ZebraGame engineLevel={3} isActive={true} rng={mulberry32(7)} onRoundEnd={onRoundEnd} />,
    );
    fireEvent.click(screen.getByRole('button', { name: expectedZebraAnswer(puzzle) }));
    expect(onRoundEnd).toHaveBeenCalledTimes(1);
    expect(onRoundEnd.mock.calls[0][0]).toEqual({ correct: true, attempts: 1 });
  });
});
