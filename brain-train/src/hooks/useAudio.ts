import { useCallback, useRef, useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export function useAudio() {
  const { soundEnabled, ttsEnabled } = useSettingsStore();
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
  }, []);

  const playEffect = useCallback((name: 'correct' | 'wrong' | 'complete' | 'tick') => {
    if (!soundEnabled) return;

    // Use Web Audio API beeps as fallback
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    switch (name) {
      case 'correct':
        oscillator.frequency.value = 880; // A5
        gainNode.gain.value = 0.3;
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
        break;
      case 'wrong':
        oscillator.frequency.value = 220; // A3
        gainNode.gain.value = 0.3;
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.2);
        break;
      case 'complete':
        oscillator.frequency.value = 1760; // A6
        gainNode.gain.value = 0.3;
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
        break;
      case 'tick':
        oscillator.frequency.value = 440; // A4
        gainNode.gain.value = 0.1;
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.05);
        break;
    }
  }, [soundEnabled]);

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
