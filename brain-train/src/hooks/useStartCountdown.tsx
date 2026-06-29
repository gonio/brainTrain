// 开局倒计时 hook：所有游戏「开始训练/下一关」后先 3-2-1 倒计时再正式开始。
// 设计要点：
//  - 倒计时结束后才真正 startGame / 激活游戏组件，保证 3 秒缓冲不计入游戏用时。
//  - 期间允许点击跳过，立即开始（照顾熟练玩家）。
//  - 每个数字出现时播一声 tick（尊重全局 soundEnabled）。
//
// phase 三态：idle（未触发）/ counting（倒计时中）/ ready（结束）
// trigger(onDone)：启动倒计时，结束/跳过时调用 onDone。
//   自由模式用法：trigger(() => { startGame(...); setGameStartTime(Date.now()); })
//   闯关用法（onDone 留空）：用 phase==='ready' 控制游戏组件挂载。
import { useCallback, useEffect, useRef, useState } from 'react';
import { StartCountdown } from '../components/game/StartCountdown';
import { useAudio } from './useAudio';

const DEFAULT_SECONDS = 3;

export type CountdownPhase = 'idle' | 'counting' | 'ready';

export function useStartCountdown(seconds: number = DEFAULT_SECONDS) {
  // count：null=未启动；>0=倒计时中；0=已结束。phase 由它派生。
  const [count, setCount] = useState<number | null>(null);
  const cbRef = useRef<(() => void) | null>(null);
  const { playEffect } = useAudio();

  // 倒计时主体 + 收尾，都用同一个 timer 链，避免在 effect 里同步 setState。
  // trigger 时启动：每秒 -1，到 0 后执行回调（回调内的 setState 是用户业务，不受本规则约束）。
  const startTimer = useCallback(
    (from: number) => {
      let remaining = from;
      // 数字到 1 时换更重的提示音（countdownFinal），强调马上开始；
      // 其余数字用轻 tick。
      const soundFor = (n: number) => (n === 1 ? 'countdownFinal' : 'tick');
      // 首声立即响（from 这个数字）
      playEffect(soundFor(from));
      const id = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(id);
          setCount(0);
          // 归 0：执行回调（在 timer 回调里，不在 effect 里）
          const cb = cbRef.current;
          cbRef.current = null;
          cb?.();
        } else {
          setCount(remaining);
          playEffect(soundFor(remaining));
        }
      }, 1000);
      return id;
    },
    [playEffect],
  );

  // 保存当前 timer id，便于跳过/卸载时清理
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 跳过：立即结束并执行回调（与自然倒数完殊途同归）
  const skip = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCount(0);
    const cb = cbRef.current;
    cbRef.current = null;
    cb?.();
  }, []);

  const trigger = useCallback(
    (onDone: () => void = () => {}) => {
      // 清理上一次未完成的倒计时（防御）
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      cbRef.current = onDone;
      setCount(seconds);
      timerRef.current = startTimer(seconds);
    },
    [seconds, startTimer],
  );

  // 卸载时清理 timer，避免泄漏/跨局串扰
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const phase: CountdownPhase =
    count === null ? 'idle' : count > 0 ? 'counting' : 'ready';

  const overlay = <StartCountdown count={count ?? 0} onSkip={skip} />;

  return { phase, count: count ?? 0, overlay, trigger };
}
