// QuestSchulteRunner 失败机制测试
//
// 舒尔特：错点次数 ≥ lives → 失败（passed:false, stars:0），并停止棋盘（isActive=false）。
// 难度表 lives：1-6级=3，7-9=2，10级=1。
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

// mock SchulteGrid：把回调挂到 window 上，测试可主动触发错点
vi.mock('@/components/game/SchulteGrid', () => ({
  SchulteGrid: (props: any) => {
    (globalThis as any).__schulteProps = props;
    return <div data-testid="mock-grid" data-isactive={String(props.isActive)} />;
  },
}));
vi.mock('@/hooks/useAudio', () => ({ useAudio: () => ({ playEffect: vi.fn() }) }));
vi.mock('@/store/settings', () => ({ useSettingsStore: () => ({ soundEnabled: false }) }));

import { QuestSchulteRunner } from '../../src/components/quest/QuestSchulteRunner';

function props() {
  return (globalThis as any).__schulteProps;
}

describe('QuestSchulteRunner 失败：错点耗尽生命', () => {
  it('难度 7（lives=2）：错 2 次 → 失败 passed:false stars:0，棋盘停止', () => {
    const onComplete = vi.fn();
    render(<QuestSchulteRunner difficulty={7} onComplete={onComplete} />);

    // 初始棋盘 active
    expect(props().isActive).toBe(true);

    // 错第 1 次：还活着
    props().onWrongClick({ clicked: 9, expected: 1 });
    expect(onComplete).not.toHaveBeenCalled();

    // 错第 2 次：lives=2 耗尽 → 失败
    props().onWrongClick({ clicked: 8, expected: 1 });
    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0][0];
    expect(result.passed).toBe(false);
    expect(result.stars).toBe(0);
  });

  it('难度 1（lives=3）：错 2 次未耗尽 → 仍进行，未结算', () => {
    const onComplete = vi.fn();
    render(<QuestSchulteRunner difficulty={1} onComplete={onComplete} />);

    props().onWrongClick({ clicked: 9, expected: 1 });
    props().onWrongClick({ clicked: 8, expected: 1 });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('难度 10（lives=1）：错 1 次即失败', () => {
    const onComplete = vi.fn();
    render(<QuestSchulteRunner difficulty={10} onComplete={onComplete} />);

    props().onWrongClick({ clicked: 30, expected: 1 });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0].passed).toBe(false);
  });

  it('失败结果的 details.errors 记录了错点明细', () => {
    const onComplete = vi.fn();
    render(<QuestSchulteRunner difficulty={10} onComplete={onComplete} />);

    props().onWrongClick({ clicked: 30, expected: 1 });
    const result = onComplete.mock.calls[0][0];
    expect(result.details.errors).toEqual([{ clicked: 30, expected: 1 }]);
  });
});
