import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { SequenceGame, ITEMS_POOL } from '../../src/components/game/SequenceGame';

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
      <SequenceGame sequenceLength={2} isActive={true} stepDurationMs={800} onComplete={onComplete} />
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

  it('step 模式：最后 item 也是 stepDurationMs 进入回忆（不再多停 1s）', () => {
    const { queryByText } = render(
      <SequenceGame sequenceLength={3} isActive={true} displayMode="step" stepDurationMs={800} onComplete={() => {}} />
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

describe('SequenceGame 记忆时长可配置（stepDurationMs）', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('默认每项 1200ms（拉长记忆时间，避免图案多了记不住）', () => {
    // 用单个 item 隔离验证时长：1 个 item 显示满 1200ms 才进入回忆
    const { queryByText } = render(
      <SequenceGame sequenceLength={1} isActive={true} onComplete={() => {}} />
    );
    // 800ms：还在记忆阶段（默认 1200ms 未满）
    act(() => { vi.advanceTimersByTime(800); });
    expect(queryByText('记住物品出现的顺序')).toBeTruthy();
    // 再到 1200ms：进入回忆
    act(() => { vi.advanceTimersByTime(400); });
    expect(queryByText('按记忆顺序点击下方物品')).toBeTruthy();
  });

  it('可自定义每项时长（如 1500ms）', () => {
    const { queryByText } = render(
      <SequenceGame sequenceLength={1} isActive={true} stepDurationMs={1500} onComplete={() => {}} />
    );
    // 1200ms：自定义 1500ms 未满，仍在记忆
    act(() => { vi.advanceTimersByTime(1200); });
    expect(queryByText('记住物品出现的顺序')).toBeTruthy();
    // 到 1500ms：进入回忆
    act(() => { vi.advanceTimersByTime(300); });
    expect(queryByText('按记忆顺序点击下方物品')).toBeTruthy();
  });
});

describe('SequenceGame flash 模式记忆时长（闯关：整段闪现，时间按长度给）', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('flash 模式：默认时长 = 序列长度×700ms + 1200ms（6 个约 5.4s，非写死 2s）', () => {
    const { queryByText } = render(
      <SequenceGame sequenceLength={6} isActive={true} displayMode="flash" onComplete={() => {}} />
    );
    // 2 秒（旧的写死值）：6 个图案远不够记忆，应仍在记忆阶段
    act(() => { vi.advanceTimersByTime(2000); });
    expect(queryByText('记住物品出现的顺序')).toBeTruthy();
    // 推进到 5400ms（6×700+1200）：进入回忆
    act(() => { vi.advanceTimersByTime(3400); });
    expect(queryByText('按记忆顺序点击下方物品')).toBeTruthy();
  });

  it('flash 模式：可通过 flashDurationMs 自定义', () => {
    const { queryByText } = render(
      <SequenceGame sequenceLength={6} isActive={true} displayMode="flash" flashDurationMs={3000} onComplete={() => {}} />
    );
    act(() => { vi.advanceTimersByTime(2500); });
    expect(queryByText('记住物品出现的顺序')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(500); });
    expect(queryByText('按记忆顺序点击下方物品')).toBeTruthy();
  });
});

describe('SequenceGame 撤销（问题3）', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('回忆阶段点击撤销可回退最后一次选择', () => {
    const { getByText, container } = render(
      <SequenceGame sequenceLength={3} isActive={true} stepDurationMs={800} onComplete={() => {}} />
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
      <SequenceGame sequenceLength={2} isActive={true} stepDurationMs={800} onComplete={onComplete} />
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

describe('SequenceGame 固定 12 图案集', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('图案集固定为 12 个（颜色不重复、形态分明）', () => {
    // 锁住集合：不可退回到 100 个随机 emoji 的旧池
    expect(ITEMS_POOL).toEqual([
      '🐶', '🐱', '🐰', '🦊', '🐸', '🐧',
      '🍎', '🍋', '🍇', '🫐', '🍑', '🐝',
    ]);
    expect(ITEMS_POOL).toHaveLength(12);
  });

  it('回忆阶段所有选项（含干扰项）都来自这 12 个图案', () => {
    const onComplete = vi.fn();
    const { container } = render(
      // 序列 7 + 干扰 3 = 10 个选项，都应落在 12 图案集内
      <SequenceGame sequenceLength={7} isActive={true} distractors={3} stepDurationMs={800} onComplete={onComplete} />
    );
    // 推进到回忆阶段（7 个 item × 800ms）
    for (let i = 0; i < 7; i++) {
      act(() => { vi.advanceTimersByTime(800); });
    }

    // 回忆阶段选项按钮：排除「撤销」按钮
    const optionButtons = Array.from(container.querySelectorAll('button')).filter(
      (b) => !b.textContent?.includes('撤销')
    );
    const optionItems = optionButtons.map((b) => b.textContent);
    // 每个选项都在 12 图案集内
    for (const item of optionItems) {
      expect(ITEMS_POOL).toContain(item);
    }
  });
});
