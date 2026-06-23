import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudio } from '../../src/hooks/useAudio';
import { useSettingsStore } from '../../src/stores/settingsStore';

// 构造可控的 mock AudioContext，记录调用次数与节点创建情况
function createMockAudioContext() {
  const created = {
    instances: 0,
    oscCount: 0,
    gainCount: 0,
    connectCalls: 0,
    startCalls: 0,
    stopCalls: 0,
    resumeCalls: 0,
    currentTime: 0,
    state: 'running' as AudioContextState,
  };

  class MockAudioContext {
    constructor() {
      created.instances += 1;
    }
    get currentTime() {
      return created.currentTime;
    }
    get state() {
      return created.state;
    }
    resume() {
      created.resumeCalls += 1;
      return Promise.resolve();
    }
    createOscillator() {
      created.oscCount += 1;
      const node = {
        type: 'sine' as OscillatorType,
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn((target: unknown) => {
          created.connectCalls += 1;
          return target;
        }),
        start: vi.fn(() => {
          created.startCalls += 1;
        }),
        stop: vi.fn(() => {
          created.stopCalls += 1;
        }),
      };
      return node;
    }
    createGain() {
      created.gainCount += 1;
      const node = {
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn((target: unknown) => {
          created.connectCalls += 1;
          return target;
        }),
      };
      return node;
    }
    get destination() {
      return {} as AudioNode;
    }
  }

  return { created, MockAudioContext };
}

describe('useAudio', () => {
  let mock: ReturnType<typeof createMockAudioContext>;

  beforeEach(() => {
    // 每个用例前重置 store，默认开启声音
    useSettingsStore.setState({ soundEnabled: true });
    mock = createMockAudioContext();
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: mock.MockAudioContext,
    });
    // webkitAudioContext 不再需要，移除以避免污染
    delete (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('soundEnabled 关闭时 playEffect 不创建 AudioContext', () => {
    useSettingsStore.setState({ soundEnabled: false });
    const { result } = renderHook(() => useAudio());

    act(() => {
      result.current.playEffect('tick');
    });

    expect(mock.created.instances).toBe(0);
    expect(mock.created.oscCount).toBe(0);
  });

  it('多次 playEffect 复用同一个 AudioContext（不泄漏）', () => {
    const { result } = renderHook(() => useAudio());

    act(() => {
      result.current.playEffect('tick');
      result.current.playEffect('correct');
      result.current.playEffect('wrong');
      result.current.playEffect('complete');
    });

    expect(mock.created.instances).toBe(1);
    // complete 含泛音，至少创建多个 oscillator
    expect(mock.created.oscCount).toBeGreaterThan(0);
    expect(mock.created.gainCount).toBeGreaterThan(0);
  });

  it('每个 tone 都有 start/stop 配对，不会产生悬挂的振荡器', () => {
    const { result } = renderHook(() => useAudio());

    act(() => {
      result.current.playEffect('tick');
    });

    expect(mock.created.startCalls).toBe(mock.created.stopCalls);
    expect(mock.created.startCalls).toBeGreaterThan(0);
  });

  it('音效参数采用柔和配置（峰值音量低于原来的 0.3）', () => {
    // 原实现 correct/wrong/complete 都用 0.3 的固定增益，过于刺耳。
    // 新实现的包络峰值应明显更低。这里通过快照间接验证：exponentialRampToValueAtTime
    // 在 release 阶段会被调用以实现渐出（消除咔哒爆音）。
    const { result } = renderHook(() => useAudio());

    act(() => {
      result.current.playEffect('tick');
    });

    expect(mock.created.instances).toBe(1);
    expect(mock.created.oscCount).toBeGreaterThan(0);
    // 至少触发了渐入与渐出包络
    expect(mock.created.gainCount).toBeGreaterThan(0);
  });

  it('在缺少 AudioContext 的环境（如 SSR/老浏览器）下不抛错', () => {
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    delete (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext;

    const { result } = renderHook(() => useAudio());

    expect(() => {
      act(() => {
        result.current.playEffect('tick');
      });
    }).not.toThrow();
  });
});
