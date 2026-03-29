import { useEffect, useState } from 'react';

interface TimerProps {
  seconds: number;
  isRunning?: boolean;
  showMilliseconds?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'compact' | 'pulse';
}

export function Timer({
  seconds,
  isRunning = false,
  showMilliseconds = false,
  size = 'md',
  variant = 'default'
}: TimerProps) {
  const [displayTime, setDisplayTime] = useState(seconds);

  useEffect(() => {
    setDisplayTime(seconds);
  }, [seconds]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    const ms = Math.floor((totalSeconds % 1) * 100);

    const parts = [
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ];

    if (showMilliseconds) {
      parts.push(ms.toString().padStart(2, '0'));
    }

    return parts.join(':');
  };

  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl'
  };

  const variantClasses = {
    default: 'p-4 bg-accent rounded-lg',
    compact: 'px-3 py-1 bg-accent rounded-md',
    pulse: `p-4 bg-accent rounded-lg ${isRunning ? 'animate-pulse' : ''}`
  };

  return (
    <div className={`inline-flex items-center gap-2 font-mono ${variantClasses[variant]}`}>
      <span className="text-muted-foreground">⏱️</span>
      <span className={`font-bold ${sizeClasses[size]}`}>
        {formatTime(displayTime)}
      </span>
    </div>
  );
}

interface CountdownTimerProps {
  duration: number;
  onComplete?: () => void;
  onTick?: (remaining: number) => void;
}

export function CountdownTimer({ duration, onComplete, onTick }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(duration);

  useEffect(() => {
    setRemaining(duration);
  }, [duration]);

  useEffect(() => {
    if (remaining <= 0) {
      onComplete?.();
      return;
    }

    const interval = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        onTick?.(next);
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [remaining, onComplete, onTick]);

  const percentage = (remaining / duration) * 100;

  return (
    <div className="w-full max-w-xs">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">剩余时间</span>
        <span className="font-mono font-bold">{remaining}s</span>
      </div>
      <div className="h-2 bg-accent rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ${
            percentage > 50 ? 'bg-green-500' : percentage > 25 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
