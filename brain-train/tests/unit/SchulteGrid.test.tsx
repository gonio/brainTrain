import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SchulteGrid } from '../../src/components/game/SchulteGrid';
import { buildAlternateWithDirections } from '../../src/lib/schulteQuestConfig';

describe('SchulteGrid', () => {
  it('渲染 3×3 网格（9 个数字）', () => {
    render(
      <SchulteGrid
        gridSize={3}
        order="asc"
        isActive={true}
        startTime={1000}
        onCorrectClick={() => {}}
        onWrongClick={() => {}}
        onComplete={() => {}}
      />
    );
    const buttons = screen.getAllByRole('button');
    // 9 个数字按钮，可能还有其他控件
    expect(buttons.length).toBeGreaterThanOrEqual(9);
  });

  it('渲染 5×5 网格（25 个数字）', () => {
    render(
      <SchulteGrid
        gridSize={5}
        order="asc"
        isActive={true}
        startTime={1000}
        onCorrectClick={() => {}}
        onWrongClick={() => {}}
        onComplete={() => {}}
      />
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(25);
  });

  it('正向模式：点击 1 是正确的', () => {
    const onCorrect = vi.fn();
    const onWrong = vi.fn();
    render(
      <SchulteGrid
        gridSize={3}
        order="asc"
        isActive={true}
        startTime={1000}
        onCorrectClick={onCorrect}
        onWrongClick={onWrong}
        onComplete={() => {}}
      />
    );
    const buttonOne = screen.getByText('1');
    fireEvent.click(buttonOne);
    expect(onCorrect).toHaveBeenCalledTimes(1);
    expect(onWrong).not.toHaveBeenCalled();
  });

  it('反向模式：点击 N（最大值）是正确的', () => {
    const onCorrect = vi.fn();
    render(
      <SchulteGrid
        gridSize={3}
        order="desc"
        isActive={true}
        startTime={1000}
        onCorrectClick={onCorrect}
        onWrongClick={() => {}}
        onComplete={() => {}}
      />
    );
    // 3×3 = 9，反向第一个目标是 9
    const buttonNine = screen.getByText('9');
    fireEvent.click(buttonNine);
    expect(onCorrect).toHaveBeenCalledTimes(1);
  });

  it('错误点击触发 onWrongClick', () => {
    const onWrong = vi.fn();
    render(
      <SchulteGrid
        gridSize={3}
        order="asc"
        isActive={true}
        startTime={1000}
        onCorrectClick={() => {}}
        onWrongClick={onWrong}
        onComplete={() => {}}
      />
    );
    // 3×3 = 9 个数字，正向第一个目标是 1，点 2 是错的
    const buttonTwo = screen.getByText('2');
    fireEvent.click(buttonTwo);
    expect(onWrong).toHaveBeenCalledTimes(1);
  });

  it('连续正确点击触发 onComboChange', () => {
    const onCombo = vi.fn();
    render(
      <SchulteGrid
        gridSize={3}
        order="asc"
        isActive={true}
        startTime={1000}
        onCorrectClick={() => {}}
        onWrongClick={() => {}}
        onComplete={() => {}}
        onComboChange={onCombo}
      />
    );
    fireEvent.click(screen.getByText('1'));
    expect(onCombo).toHaveBeenLastCalledWith(1);
    fireEvent.click(screen.getByText('2'));
    expect(onCombo).toHaveBeenLastCalledWith(2);
  });

  it('错误点击清零 combo', () => {
    const onCombo = vi.fn();
    render(
      <SchulteGrid
        gridSize={3}
        order="asc"
        isActive={true}
        startTime={1000}
        onCorrectClick={() => {}}
        onWrongClick={() => {}}
        onComplete={() => {}}
        onComboChange={onCombo}
      />
    );
    fireEvent.click(screen.getByText('1')); // combo 1
    fireEvent.click(screen.getByText('2')); // combo 2
    fireEvent.click(screen.getByText('4')); // 错：下一个应该是 3
    expect(onCombo).toHaveBeenLastCalledWith(0);
  });

  it('完成所有数字触发 onComplete', () => {
    const onComplete = vi.fn();
    render(
      <SchulteGrid
        gridSize={3}
        order="asc"
        isActive={true}
        startTime={1000}
        onCorrectClick={() => {}}
        onWrongClick={() => {}}
        onComplete={onComplete}
      />
    );
    // 3×3 = 9，按 1..9 顺序点击完成
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('2'));
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByText('4'));
    fireEvent.click(screen.getByText('5'));
    fireEvent.click(screen.getByText('6'));
    fireEvent.click(screen.getByText('7'));
    fireEvent.click(screen.getByText('8'));
    fireEvent.click(screen.getByText('9'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('错误点击给该格添加红色反馈样式（错点可见反馈）', () => {
    render(
      <SchulteGrid
        gridSize={3}
        order="asc"
        isActive={true}
        startTime={1000}
        onCorrectClick={() => {}}
        onWrongClick={() => {}}
        onComplete={() => {}}
      />
    );
    const buttonTwo = screen.getByText('2'); // asc 首目标 1，点 2 是错的
    fireEvent.click(buttonTwo);
    expect(buttonTwo.className).toMatch(/red/);
  });

  it('onTargetChange 报告当前目标，点对后推进', () => {
    const onTarget = vi.fn();
    render(
      <SchulteGrid
        gridSize={3}
        order="asc"
        isActive={true}
        startTime={1000}
        onCorrectClick={() => {}}
        onWrongClick={() => {}}
        onComplete={() => {}}
        onTargetChange={onTarget}
      />
    );
    // 挂载后第一个目标是 1
    expect(onTarget).toHaveBeenLastCalledWith(1);
    fireEvent.click(screen.getByText('1'));
    // 点对后推进到 2
    expect(onTarget).toHaveBeenLastCalledWith(2);
  });

  it('交替模式不报具体数字（onTargetChange 始终为 null）', () => {
    const onTarget = vi.fn();
    const onDirection = vi.fn();
    render(
      <SchulteGrid
        gridSize={3}
        order="alternate"
        isActive={true}
        startTime={1000}
        onCorrectClick={() => {}}
        onWrongClick={() => {}}
        onComplete={() => {}}
        onTargetChange={onTarget}
        onDirectionChange={onDirection}
      />
    );
    // 交替模式：不暴露具体目标数字，只报方向
    expect(onTarget).toHaveBeenLastCalledWith(null);
    expect(onDirection).toHaveBeenLastCalledWith(expect.stringMatching(/正|反/));
  });

  it('buildAlternateWithDirections：覆盖全部 N 个数字、方向为正/反', () => {
    const { sequence, directions } = buildAlternateWithDirections(9, 1000);
    // 覆盖 1-9 全部、无重复
    expect([...sequence].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(directions.every((d) => d === '正' || d === '反')).toBe(true);
    expect(directions.length).toBe(9);
  });

  it('buildAlternateWithDirections：同 seed 可复现，不同 seed 一般不同', () => {
    const a1 = buildAlternateWithDirections(9, 42);
    const a2 = buildAlternateWithDirections(9, 42);
    expect(a1.sequence).toEqual(a2.sequence); // 同 seed 复现

    const b = buildAlternateWithDirections(9, 999);
    // 不同 seed 大概率产生不同序列（极小概率撞同序列）
    expect(b.sequence).not.toEqual(a1.sequence);
  });

  it('buildAlternateWithDirections：相邻同方向步长不超过 4', () => {
    const { directions } = buildAlternateWithDirections(25, 7);
    // 任一连续同方向段长度应在 1-4
    let runLen = 1;
    for (let i = 1; i < directions.length; i++) {
      if (directions[i] === directions[i - 1]) {
        runLen++;
        expect(runLen).toBeLessThanOrEqual(4);
      } else {
        runLen = 1;
      }
    }
  });

  it('floatingTarget：紧贴棋盘显示目标数字', () => {
    const { container } = render(
      <SchulteGrid
        gridSize={3}
        order="asc"
        isActive={true}
        startTime={1000}
        onCorrectClick={() => {}}
        onWrongClick={() => {}}
        onComplete={() => {}}
        floatingTarget={{ target: 1, direction: null, perNumberTime: 5, perNumberTotal: 5, isAlternate: false }}
      />
    );
    // 棋盘上沿叠加层显示目标数字（与网格里的数字 1 区分，只查叠加层）
    const overlay = container.querySelector('.absolute.left-1\\/2');
    expect(overlay).not.toBeNull();
    expect(overlay?.textContent).toContain('1');
  });

  it('floatingTarget：交替模式显示方向、不显示目标数字', () => {
    const { container } = render(
      <SchulteGrid
        gridSize={3}
        order="alternate"
        isActive={true}
        startTime={1000}
        onCorrectClick={() => {}}
        onWrongClick={() => {}}
        onComplete={() => {}}
        floatingTarget={{ target: null, direction: '正', perNumberTime: 6, perNumberTotal: 6, isAlternate: true }}
      />
    );
    const overlay = container.querySelector('.absolute.left-1\\/2');
    expect(overlay?.textContent).toContain('正');
  });

  it('floatingTarget：剩余 ≤ 20% 倒计时进入危险（红）样式', () => {
    const { container } = render(
      <SchulteGrid
        gridSize={3}
        order="desc"
        isActive={true}
        startTime={1000}
        onCorrectClick={() => {}}
        onWrongClick={() => {}}
        onComplete={() => {}}
        floatingTarget={{ target: 9, direction: null, perNumberTime: 0.4, perNumberTotal: 3, isAlternate: false }}
      />
    );
    // 危险态叠加层用红色背景
    const overlay = container.querySelector('.absolute.left-1\\/2');
    expect(overlay?.className).toMatch(/red/);
  });
});
