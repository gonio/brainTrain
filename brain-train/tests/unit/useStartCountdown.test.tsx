// useStartCountdown 单元测试
//
// 覆盖 hook 本身的核心行为：
//  - trigger() 后立即进入 counting，count=初始秒数
//  - 每秒 count 递减，到 0 执行回调并进入 ready
//  - skip() 立即结束并执行回调
//  - trigger() 再次调用会重置（幂等，清掉旧 interval 重启）
//
// 注意：StrictMode 双挂载导致「挂载即 trigger」卡死的回归测试，
// 见 QuestRunnerCountdown.test.tsx（渲染真实 QuestRunner）。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStartCountdown } from '../../src/hooks/useStartCountdown';

describe('useStartCountdown', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('trigger 后进入 counting，count 为初始秒数', () => {
    const { result } = renderHook(() => useStartCountdown(3));
    expect(result.current.phase).toBe('idle');

    act(() => {
      result.current.trigger(() => {});
    });

    expect(result.current.phase).toBe('counting');
    expect(result.current.count).toBe(3);
  });

  it('每秒递减，到 0 执行回调并进入 ready', () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useStartCountdown(3));

    act(() => {
      result.current.trigger(onDone);
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.count).toBe(2);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.count).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // 倒计时结束
    expect(result.current.phase).toBe('ready');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('skip() 立即结束并执行回调（与自然倒数完殊途同归）', () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useStartCountdown(3));

    act(() => {
      result.current.trigger(onDone);
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.count).toBe(2);

    act(() => {
      result.current.overlay.props.onSkip();
    });

    expect(result.current.phase).toBe('ready');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('trigger() 再次调用会重置倒计时（清理旧 interval 重启）', () => {
    const { result } = renderHook(() => useStartCountdown(3));

    act(() => {
      result.current.trigger(() => {});
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.count).toBe(1);

    // 再次 trigger：从 3 重新开始
    act(() => {
      result.current.trigger(() => {});
    });
    expect(result.current.count).toBe(3);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // 应只递减一次到 2（旧 interval 已被清理，不会双倍递减）
    expect(result.current.count).toBe(2);
  });
});
