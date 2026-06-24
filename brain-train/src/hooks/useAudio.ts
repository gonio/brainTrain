import { useCallback, useRef, useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export type SoundEffect = 'correct' | 'wrong' | 'complete' | 'tick';

// 模块级共享 AudioContext 单例：所有调用 useAudio() 的组件复用同一个，
// 避免每个 hook 实例各建一个 context 增加资源占用、触发浏览器并发限制。
let sharedAudioCtx: AudioContext | null = null;

// 仅测试用：重置模块级单例，避免测试用例间状态串扰。
export function __resetSharedAudioContextForTest(): void {
  sharedAudioCtx = null;
}

// 每种音效的合成参数。
// 用渐入渐出的 ADSR 包络替代原来的「硬开关」，避免咔哒爆音；
// 选用更柔和的正弦/三角波，频率落在人耳舒适的中频段。
interface ToneSpec {
  freq: number;          // 基础频率
  type: OscillatorType;  // 波形
  duration: number;      // 持续时间（秒）
  gain: number;          // 峰值音量（已统一调低）
  attack?: number;       // 渐入（秒），默认 0.005
  release?: number;      // 渐出（秒），默认 duration 的一半
  harmonics?: { freq: number; gain: number }[]; // 叠加的泛音，让音色更丰满柔和
}

const TONE_PRESETS: Record<SoundEffect, ToneSpec> = {
  // 正向反馈：明亮但柔和的五度上行，类似轻快的「叮」
  correct: {
    freq: 587.33, // D5
    type: 'sine',
    duration: 0.18,
    gain: 0.16,
    attack: 0.005,
    release: 0.16,
    harmonics: [
      { freq: 880.0, gain: 0.08 }, // A5，五度
    ],
  },
  // 错误：低沉柔和的下行，不刺耳
  wrong: {
    freq: 196.0, // G3
    type: 'triangle',
    duration: 0.25,
    gain: 0.14,
    attack: 0.01,
    release: 0.22,
    harmonics: [
      { freq: 146.83, gain: 0.06 }, // D3，下行
    ],
  },
  // 完成：欢快的三音琶音（C5-E5-G5），有结束感
  complete: {
    freq: 523.25, // C5
    type: 'sine',
    duration: 0.5,
    gain: 0.15,
    attack: 0.005,
    release: 0.4,
    harmonics: [
      { freq: 659.25, gain: 0.12 }, // E5
      { freq: 783.99, gain: 0.1 },  // G5
    ],
  },
  // 点击：极短极轻的轻击，像翻页声
  tick: {
    freq: 660.0,
    type: 'sine',
    duration: 0.06,
    gain: 0.07,
    attack: 0.002,
    release: 0.058,
  },
};

export function useAudio() {
  const { soundEnabled, ttsEnabled } = useSettingsStore();
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
  }, []);

  // AudioContext 必须在用户手势后才能正常 resume，这里延迟创建并尝试恢复。
  // 用模块级单例（而非 useRef）：多个组件各自调用 useAudio() 也共享同一个 AudioContext，
  // 否则会创建多个 context 增加资源占用、触发浏览器并发限制。
  const getAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    if (!sharedAudioCtx) {
      sharedAudioCtx = new Ctor();
    }
    // 部分浏览器会以 suspended 状态启动，播放前尝试恢复
    if (sharedAudioCtx.state === 'suspended') {
      void sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  }, []);

  // 播放单个 tone（基础频率 + 可选泛音），统一应用 ADSR 包络
  const playTone = useCallback(
    (ctx: AudioContext, spec: ToneSpec, startOffset: number) => {
      const now = ctx.currentTime + startOffset;
      const attack = spec.attack ?? 0.005;
      const release = spec.release ?? spec.duration * 0.5;
      const peak = spec.gain;

      // 主音
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = spec.type;
      osc.frequency.setValueAtTime(spec.freq, now);
      // 包络：attack 渐入 → sustain → release 渐出到 0，消除咔哒爆音
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(peak, now + attack);
      gain.gain.setValueAtTime(peak, now + spec.duration - release);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + spec.duration + 0.02);

      // 泛音：每个错开一点点时间（complete 的琶音效果），各自独立包络
      spec.harmonics?.forEach((h, i) => {
        const hStart = now + (i + 1) * 0.07;
        const hOsc = ctx.createOscillator();
        const hGain = ctx.createGain();
        hOsc.type = spec.type;
        hOsc.frequency.setValueAtTime(h.freq, hStart);
        hGain.gain.setValueAtTime(0.0001, hStart);
        hGain.gain.linearRampToValueAtTime(h.gain, hStart + attack);
        hGain.gain.exponentialRampToValueAtTime(0.0001, hStart + spec.duration);
        hOsc.connect(hGain).connect(ctx.destination);
        hOsc.start(hStart);
        hOsc.stop(hStart + spec.duration + 0.02);
      });
    },
    []
  );

  const playEffect = useCallback(
    (name: SoundEffect) => {
      if (!soundEnabled) return;

      const ctx = getAudioContext();
      if (!ctx) return;

      playTone(ctx, TONE_PRESETS[name], 0);
    },
    [soundEnabled, getAudioContext, playTone]
  );

  const speak = useCallback((text: string) => {
    if (!ttsEnabled || !synthRef.current) return;

    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.9;
    synthRef.current.speak(utterance);
  }, [ttsEnabled]);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
  }, []);

  return {
    playEffect,
    speak,
    stopSpeaking,
    isSoundEnabled: soundEnabled,
    isTTSEnabled: ttsEnabled
  };
}
