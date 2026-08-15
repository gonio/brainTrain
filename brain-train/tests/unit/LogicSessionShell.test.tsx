import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LogicSessionShell } from '@/components/game/LogicSessionShell';

describe('LogicSessionShell', () => {
  const noop = () => {};
  it('初始渲染开始屏与三档难度', () => {
    render(
      <LogicSessionShell
        mode="syllogism"
        title="说得通吗"
        description="测试"
        engineLevels={{ easy: [1, 7], medium: [8, 14], hard: [15, 20] }}
        renderRound={() => null}
      />,
    );
    expect(screen.getByText('说得通吗')).toBeTruthy();
    expect(screen.getByText('开始训练')).toBeTruthy();
    expect(screen.getByText('简单')).toBeTruthy();
    expect(screen.getByText('困难')).toBeTruthy();
  });
  it('难度可切换选中态', () => {
    render(
      <LogicSessionShell
        mode="syllogism" title="说得通吗" description="测试"
        engineLevels={{ easy: [1, 7], medium: [8, 14], hard: [15, 20] }}
        renderRound={() => null}
      />,
    );
    const hard = screen.getByText('困难');
    fireEvent.click(hard);
    expect(hard.className).toContain('bg-primary');
  });
});
