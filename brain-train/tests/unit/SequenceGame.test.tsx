import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
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
