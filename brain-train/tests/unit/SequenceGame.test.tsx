import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { SequenceGame } from '../../src/components/game/SequenceGame';

// SequenceGame 状态机测试：聚焦 isActive 流转和重置
// 复现"再玩一次卡住"的 bug

describe('SequenceGame 状态机', () => {
  it('isActive=false 时显示"点击开始训练"提示', () => {
    const { getByText } = render(
      <SequenceGame sequenceLength={4} isActive={false} onComplete={() => {}} />
    );
    expect(getByText('点击开始训练进入游戏')).toBeTruthy();
  });

  it('isActive 从 false→true 时重置 phase 到 memorize（显示记忆阶段而非结束态）', () => {
    const onComplete = vi.fn();
    const { getByText, rerender } = render(
      <SequenceGame sequenceLength={4} isActive={false} onComplete={onComplete} />
    );

    // 进入游戏
    rerender(<SequenceGame sequenceLength={4} isActive={true} onComplete={onComplete} />);

    // 应该显示记忆阶段（而非"点击开始训练"）
    expect(() => getByText('点击开始训练进入游戏')).toThrow();
    expect(getByText('记住物品出现的顺序')).toBeTruthy();
  });

  it('完成一局后 isActive 再变 true（再玩一次），重新进入记忆阶段', () => {
    const onComplete = vi.fn();
    const { getByText, rerender } = render(
      <SequenceGame sequenceLength={4} isActive={true} onComplete={onComplete} />
    );

    // 模拟第一局完成（isActive 变 false 表示结束）
    rerender(<SequenceGame sequenceLength={4} isActive={false} onComplete={onComplete} />);

    // 再玩一次：isActive 变 true
    rerender(<SequenceGame sequenceLength={4} isActive={true} onComplete={onComplete} />);

    // 关键断言：应该重新显示记忆阶段提示，而不是卡在之前的状态
    expect(getByText('记住物品出现的顺序')).toBeTruthy();
  });
});

// ── 本次修复的三个问题的回归测试 ──

// fake timers 下分步推进：每个 item 显示 800ms，逐个 act 让 setState→渲染→新 timer 完整流转
function advanceToRecall(items: number) {
  for (let i = 0; i < items; i++) {
    act(() => { vi.advanceTimersByTime(800); });
  }
}

describe('SequenceGame 准确率评分（问题1）', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('无干扰项时 hasDistractors=false，itemAccuracy 恒为 100', () => {
    const onComplete = vi.fn();
    const { getByText, container } = render(
      <SequenceGame sequenceLength={2} isActive={true} onComplete={onComplete} />
    );

    advanceToRecall(2);
    expect(getByText('按记忆顺序点击下方物品')).toBeTruthy();

    const itemButtons = Array.from(container.querySelectorAll('button')).filter(
      (b) => !b.textContent?.includes('撤销')
    );
    fireEvent.click(itemButtons[0]);
    fireEvent.click(itemButtons[1]);

    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0][0];
    expect(result.hasDistractors).toBe(false);
    expect(result.itemAccuracy).toBe(100); // 无干扰项时恒为 100
    expect(result.positionAccuracy).toBeGreaterThanOrEqual(0);
    expect(result.positionAccuracy).toBeLessThanOrEqual(100);
  });
});

describe('SequenceGame 记忆阶段时长（问题2：最后 item 不再多停 1s）', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('step 模式：最后 item 也是 800ms 进入回忆（不再多停 1s）', () => {
    const { queryByText } = render(
      <SequenceGame sequenceLength={3} isActive={true} displayMode="step" onComplete={() => {}} />
    );

    // 分步推进前 2 个 item（每个 800ms）
    act(() => { vi.advanceTimersByTime(800); });
    act(() => { vi.advanceTimersByTime(800); });
    // 此时第 3 个（最后）item 正在显示，仍在记忆阶段
    expect(queryByText('记住物品出现的顺序')).toBeTruthy();

    // 关键断言：最后 item 只需 800ms（而非旧的 1800ms）即进入回忆
    act(() => { vi.advanceTimersByTime(800); });
    expect(queryByText('按记忆顺序点击下方物品')).toBeTruthy();
    expect(queryByText('记住物品出现的顺序')).toBeNull();

    // 反证：如果是旧逻辑（1800ms），800ms 时不应进入回忆——上面已通过
  });
});

describe('SequenceGame 撤销（问题3）', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('回忆阶段点击撤销可回退最后一次选择', () => {
    const { getByText, container } = render(
      <SequenceGame sequenceLength={3} isActive={true} onComplete={() => {}} />
    );

    advanceToRecall(3);
    expect(getByText('按记忆顺序点击下方物品')).toBeTruthy();

    const undoBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('撤销')
    )!;
    expect(undoBtn.hasAttribute('disabled')).toBe(true);

    const itemButtons = Array.from(container.querySelectorAll('button')).filter(
      (b) => !b.textContent?.includes('撤销')
    );
    fireEvent.click(itemButtons[0]);
    expect(undoBtn.hasAttribute('disabled')).toBe(false);

    fireEvent.click(undoBtn);
    expect(undoBtn.hasAttribute('disabled')).toBe(true);
  });

  it('无干扰项时，撤销后可重新选同一物品', () => {
    const onComplete = vi.fn();
    const { getByText, container } = render(
      <SequenceGame sequenceLength={2} isActive={true} onComplete={onComplete} />
    );

    advanceToRecall(2);
    expect(getByText('按记忆顺序点击下方物品')).toBeTruthy();

    const itemButtons = Array.from(container.querySelectorAll('button')).filter(
      (b) => !b.textContent?.includes('撤销')
    );
    const undoBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('撤销')
    )!;

    fireEvent.click(itemButtons[0]);
    fireEvent.click(undoBtn);
    // 无干扰项，撤销后该物品不 disabled，可重新选
    expect(itemButtons[0].hasAttribute('disabled')).toBe(false);
    fireEvent.click(itemButtons[0]);
    fireEvent.click(itemButtons[1]);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
