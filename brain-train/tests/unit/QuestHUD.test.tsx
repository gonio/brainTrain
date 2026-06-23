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

  it('combo 区域使用固定高度槽位，连击递增不会撑高布局（修复棋盘抖动）', () => {
    // combo 刚达到阈值（首次出现）
    const { container: c1, rerender } = render(
      <QuestHUD level={5} direction="asc" lives={3} combo={5} />
    );
    const slot5 = c1.querySelector('.relative.h-14');
    expect(slot5).not.toBeNull();

    // combo 继续递增：槽位高度恒定，只有内部绝对定位元素在动
    rerender(<QuestHUD level={5} direction="asc" lives={3} combo={6} />);
    const slot6 = c1.querySelector('.relative.h-14');
    expect(slot6).toBe(slot5);
  });

  it('显示每数字倒计时数字', () => {
    render(
      <QuestHUD
        level={9}
        direction="desc"
        lives={1}
        combo={0}
        remainingTime={20}
        totalTime={27}
        perNumberTime={2.3}
        perNumberTotal={3}
      />
    );
    expect(screen.getByTestId('per-number-time')).toHaveTextContent('2.3');
  });

  it('每数字倒计时剩余 ≤ 20% 进入危险（红色）样式', () => {
    render(
      <QuestHUD
        level={9}
        direction="desc"
        lives={1}
        combo={0}
        remainingTime={5}
        totalTime={27}
        perNumberTime={0.4}
        perNumberTotal={3}
      />
    );
    const el = screen.getByTestId('per-number-time');
    expect(el.className).toMatch(/red/);
  });

  it('显示下一个目标数字与当前进度', () => {
    render(
      <QuestHUD
        level={1}
        direction="asc"
        lives={3}
        combo={0}
        perNumberTime={5}
        perNumberTotal={5}
        currentTarget={3}
        correctClickCount={2}
        gridTotal={9}
      />
    );
    // 下一个目标 3，进度 2/9
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2/9')).toBeInTheDocument();
  });

  it('正向关显示「正向」步进标签', () => {
    render(
      <QuestHUD
        level={1}
        direction="asc"
        lives={3}
        combo={0}
        perNumberTime={5}
        perNumberTotal={5}
        currentTarget={1}
        gridTotal={9}
      />
    );
    // 顶部方向条 + 下一个提示都会出现「正向」
    const matches = screen.getAllByText('正向');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
