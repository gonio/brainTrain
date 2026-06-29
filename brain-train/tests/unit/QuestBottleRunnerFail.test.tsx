// QuestBottleRunner 失败机制测试
//
// 暗瓶：超时未完成（玩家序列与目标不一致）→ 失败（passed:false, stars:0）。
// BottleGame 超时分支上抛 timedOutAndIncomplete 标志，Runner 据此判定。
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/components/game/BottleGame', () => ({
  BottleGame: (props: any) => {
    (globalThis as any).__bottleProps = props;
    return <div data-testid="mock-bottle" />;
  },
}));
vi.mock('@/hooks/useAudio', () => ({ useAudio: () => ({ playEffect: vi.fn() }) }));
vi.mock('@/store/settings', () => ({ useSettingsStore: () => ({ soundEnabled: false }) }));

import { QuestBottleRunner } from '../../src/components/quest/QuestBottleRunner';

function props() {
  return (globalThis as any).__bottleProps;
}

describe('QuestBottleRunner 失败：超时未完成', () => {
  it('超时且未完成（timedOutAndIncomplete=true）→ 失败 passed:false stars:0', () => {
    const onComplete = vi.fn();
    render(<QuestBottleRunner difficulty={10} onComplete={onComplete} />);

    // 模拟 BottleGame 超时回调：未完成
    props().onComplete(99, 5, [1, 2, 3], [1, 3, 2], true);
    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0][0];
    expect(result.passed).toBe(false);
    expect(result.stars).toBe(0);
  });

  it('超时但碰巧排对（timedOutAndIncomplete=false）→ 算完成 passed:true', () => {
    const onComplete = vi.fn();
    render(<QuestBottleRunner difficulty={10} onComplete={onComplete} />);

    // 正常完成（步数=最优 → 3 星）
    props().onComplete(5, 5, [1, 2, 3], [1, 2, 3], false);
    const result = onComplete.mock.calls[0][0];
    expect(result.passed).toBe(true);
    expect(result.stars).toBe(3);
  });

  it('正常完成（无超时）→ passed:true，按步数算星', () => {
    const onComplete = vi.fn();
    render(<QuestBottleRunner difficulty={5} onComplete={onComplete} />);

    props().onComplete(10, 7, [1, 2, 3, 4], [1, 2, 3, 4], false);
    const result = onComplete.mock.calls[0][0];
    expect(result.passed).toBe(true);
  });
});
