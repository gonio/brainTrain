import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VersusSchulteBoard } from '../../src/components/versus/VersusSchulteBoard';

// mock framer-motion（jsdom 下避免动画问题）
vi.mock('framer-motion', () => ({
  motion: { button: ({ children, ...props }: any) => <button {...props}>{children}</button> },
}));

describe('VersusSchulteBoard', () => {
  const grid = [1, 2, 3, 4, 5, 6, 7, 8, 9]; // 3x3 简化测试

  it('渲染 grid 所有数字', () => {
    render(<VersusSchulteBoard grid={grid} size={3} onTap={() => {}} />);
    for (const n of grid) {
      expect(screen.getByText(String(n))).toBeInTheDocument();
    }
  });

  it('点击正确数字触发 onTap（cellIndex）', () => {
    const onTap = vi.fn();
    render(<VersusSchulteBoard grid={grid} size={3} onTap={onTap} />);
    // 该点 1，grid[0]=1，cellIndex=0
    fireEvent.click(screen.getByText('1'));
    expect(onTap).toHaveBeenCalledWith(0);
  });

  it('点错不推进（但仍 emit tap 让服务器记错）', () => {
    const onTap = vi.fn();
    render(<VersusSchulteBoard grid={grid} size={3} onTap={onTap} />);
    // 该点 1，但点 grid[1]=2
    fireEvent.click(screen.getByText('2'));
    expect(onTap).toHaveBeenCalledWith(1);
    // 再点 1 仍触发（没因错点锁死）
    fireEvent.click(screen.getByText('1'));
    expect(onTap).toHaveBeenCalledWith(0);
  });

  it('disabled 时不响应点击', () => {
    const onTap = vi.fn();
    render(<VersusSchulteBoard grid={grid} size={3} onTap={onTap} disabled />);
    fireEvent.click(screen.getByText('1'));
    expect(onTap).not.toHaveBeenCalled();
  });
});
