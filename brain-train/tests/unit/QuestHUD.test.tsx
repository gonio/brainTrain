import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuestHUD } from '../../src/components/game/QuestHUD';

describe('QuestHUD', () => {
  it('显示关卡号和方向', () => {
    render(
      <QuestHUD
        level={5}
        direction="desc"
        lives={3}
        combo={12}
        remainingTime={undefined}
      />
    );
    expect(screen.getByText(/L5/)).toBeInTheDocument();
    expect(screen.getByText(/反向/)).toBeInTheDocument();
  });

  it('显示命数（3 命用 3 个 ❤）', () => {
    render(
      <QuestHUD level={5} direction="desc" lives={3} combo={0} remainingTime={undefined} />
    );
    const hearts = screen.getAllByText('❤');
    expect(hearts).toHaveLength(3);
  });

  it('命数减少时显示更少 ❤', () => {
    render(
      <QuestHUD level={5} direction="desc" lives={1} combo={0} remainingTime={undefined} />
    );
    const hearts = screen.getAllByText('❤');
    expect(hearts).toHaveLength(1);
  });

  it('combo > 0 时显示 COMBO 数字', () => {
    render(
      <QuestHUD level={5} direction="desc" lives={3} combo={8} remainingTime={undefined} />
    );
    expect(screen.getByText(/×8/)).toBeInTheDocument();
  });

  it('combo = 0 时不显示 COMBO 数字', () => {
    render(
      <QuestHUD level={5} direction="desc" lives={3} combo={0} remainingTime={undefined} />
    );
    expect(screen.queryByText(/COMBO/)).not.toBeInTheDocument();
  });

  it('有时限时显示剩余时间', () => {
    render(
      <QuestHUD level={5} direction="desc" lives={3} combo={0} remainingTime={23} />
    );
    expect(screen.getByText(/23/)).toBeInTheDocument();
  });

  it('无时限时不显示时间', () => {
    render(
      <QuestHUD level={1} direction="asc" lives={3} combo={0} remainingTime={undefined} />
    );
    expect(screen.queryByText(/⏱/)).not.toBeInTheDocument();
  });

  it('剩余时间 < 25% 时进度条变红', () => {
    const { container } = render(
      <QuestHUD
        level={5}
        direction="desc"
        lives={3}
        combo={0}
        remainingTime={10}
        totalTime={125}
      />
    );
    const bar = container.querySelector('[data-testid="time-bar"]');
    expect(bar?.className).toMatch(/red|bg-red/);
  });
});
