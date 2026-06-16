import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SchulteGrid } from '../../src/components/game/SchulteGrid';

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
});
