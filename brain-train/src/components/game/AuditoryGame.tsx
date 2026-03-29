import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAudio } from '@/hooks/useAudio';

// 难度配置
type Difficulty = 'easy' | 'medium' | 'hard';

interface AuditoryGameProps {
  difficulty: Difficulty;
  withNoise: boolean;
  isActive: boolean;
  onComplete: (result: {
    sequence: number[];
    userSequence: number[];
    correctCount: number;
  }) => void;
}

export function AuditoryGame({
  difficulty,
  withNoise,
  isActive,
  onComplete
}: AuditoryGameProps) {
  const [sequence, setSequence] = useState<number[]>([]);
  const [userSequence, setUserSequence] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<'playing' | 'input'>('playing');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [replayCount, setReplayCount] = useState(2); // 允许重播次数

  const { speak } = useAudio();
  const noiseRef = useRef<{ stop: () => void } | null>(null);

  // 根据难度生成序列长度
  const sequenceLength = {
    easy: 3,
    medium: 5,
    hard: 7,
  }[difficulty];

  // 生成随机数字序列
  const generateSequence = useCallback(() => {
    const newSequence = Array.from({ length: sequenceLength }, () =>
      Math.floor(Math.random() * 10)
    );
    setSequence(newSequence);
    return newSequence;
  }, [sequenceLength]);

  // 播放白噪音
  const startNoise = useCallback(() => {
    if (!withNoise) return;
    // 创建白噪音（使用 Web Audio API）
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const bufferSize = 2 * audioContext.sampleRate;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = audioContext.createBufferSource();
    whiteNoise.buffer = buffer;
    whiteNoise.loop = true;

    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0.1; // 低音量

    whiteNoise.connect(gainNode);
    gainNode.connect(audioContext.destination);
    whiteNoise.start();

    noiseRef.current = {
      stop: () => {
        whiteNoise.stop();
        audioContext.close();
      },
    };
  }, [withNoise]);

  const stopNoise = useCallback(() => {
    if (noiseRef.current) {
      noiseRef.current.stop();
      noiseRef.current = null;
    }
  }, []);

  // 播放序列
  const playSequence = useCallback(async (seq: number[]) => {
    setIsSpeaking(true);

    if (withNoise) {
      startNoise();
    }

    for (let i = 0; i < seq.length; i++) {
      setCurrentIndex(i);
      speak(seq[i].toString());
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    setIsSpeaking(false);
    stopNoise();
    setPhase('input');
  }, [speak, withNoise, startNoise, stopNoise]);

  // 开始游戏
  useEffect(() => {
    if (!isActive) {
      setUserSequence([]);
      setCurrentIndex(0);
      setPhase('playing');
      setReplayCount(2);
      stopNoise();
      return;
    }

    const seq = generateSequence();
    setTimeout(() => {
      playSequence(seq);
    }, 1000);

    return () => {
      stopNoise();
    };
  }, [isActive, generateSequence, playSequence, stopNoise]);

  // 重播
  const handleReplay = useCallback(() => {
    if (replayCount <= 0 || phase !== 'input') return;
    setReplayCount(prev => prev - 1);
    setPhase('playing');
    setTimeout(() => {
      playSequence(sequence);
    }, 500);
  }, [replayCount, phase, sequence, playSequence]);

  // 数字输入
  const handleNumberInput = useCallback((num: number) => {
    if (phase !== 'input') return;

    const newUserSequence = [...userSequence, num];
    setUserSequence(newUserSequence);

    // 检查是否完成
    if (newUserSequence.length === sequence.length) {
      const correctCount = newUserSequence.filter((n, i) => n === sequence[i]).length;

      onComplete({
        sequence,
        userSequence: newUserSequence,
        correctCount,
      });
    }
  }, [phase, userSequence, sequence, onComplete]);

  // 删除最后一位
  const handleBackspace = useCallback(() => {
    if (phase !== 'input' || userSequence.length === 0) return;
    setUserSequence(prev => prev.slice(0, -1));
  }, [phase, userSequence]);

  // 如果游戏不活跃
  if (!isActive) {
    return (
      <div className="w-full max-w-md mx-auto text-center py-12">
        <div className="text-6xl mb-4">👂</div>
        <p className="text-muted-foreground">点击开始训练进入游戏</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* 阶段指示 */}
      <div className="mb-6 text-center">
        <div className="text-sm text-muted-foreground mb-2">
          {phase === 'playing' ? '仔细听...' : '输入你听到的数字'}
        </div>
        <div className="flex justify-center gap-2">
          {Array.from({ length: sequenceLength }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-all",
                phase === 'playing' && i === currentIndex && isSpeaking
                  ? "bg-primary text-primary-foreground scale-110"
                  : phase === 'input' && i < userSequence.length
                  ? "bg-primary/20 text-primary"
                  : "bg-accent text-muted-foreground"
              )}
            >
              {phase === 'input' && i < userSequence.length ? userSequence[i] : ''}
            </div>
          ))}
        </div>
      </div>

      {/* 播放中动画 */}
      {phase === 'playing' && (
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <motion.div
              animate={{
                scale: isSpeaking ? [1, 1.2, 1] : 1,
                opacity: isSpeaking ? [0.5, 1, 0.5] : 0.5,
              }}
              transition={{
                duration: 0.5,
                repeat: Infinity,
              }}
              className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center"
            >
              <span className="text-4xl">🔊</span>
            </motion.div>
            {withNoise && (
              <div className="absolute -top-2 -right-2 text-xs bg-yellow-500 text-white px-2 py-1 rounded-full">
                干扰
              </div>
            )}
          </div>
        </div>
      )}

      {/* 输入阶段 */}
      {phase === 'input' && (
        <div className="space-y-4">
          {/* 重播按钮 */}
          <div className="flex justify-center">
            <button
              onClick={handleReplay}
              disabled={replayCount <= 0}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                replayCount > 0
                  ? "bg-secondary hover:bg-secondary/80"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              🔊 重播 ({replayCount} 次)
            </button>
          </div>

          {/* 数字键盘 */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <motion.button
                key={num}
                onClick={() => handleNumberInput(num)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="aspect-square rounded-xl bg-surface-container hover:bg-surface-container-high text-2xl font-bold shadow-md hover:shadow-lg transition-all"
              >
                {num}
              </motion.button>
            ))}
            <button
              onClick={handleBackspace}
              className="aspect-square rounded-xl bg-accent hover:bg-accent/80 text-xl font-bold shadow-md transition-all flex items-center justify-center"
            >
              ←
            </button>
            <motion.button
              onClick={() => handleNumberInput(0)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="aspect-square rounded-xl bg-surface-container hover:bg-surface-container-high text-2xl font-bold shadow-md hover:shadow-lg transition-all"
            >
              0
            </motion.button>
            <button
              disabled
              className="aspect-square rounded-xl bg-muted opacity-50"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export { type Difficulty };
