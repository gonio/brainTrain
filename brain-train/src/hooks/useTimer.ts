import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTimerReturn {
  elapsed: number;
  isRunning: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
}

export function useTimer(): UseTimerReturn {
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const updateElapsed = useCallback(() => {
    if (startTimeRef.current !== null) {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      rafRef.current = requestAnimationFrame(updateElapsed);
    }
  }, []);

  const start = useCallback(() => {
    if (!isRunning) {
      startTimeRef.current = Date.now() - elapsed * 1000;
      setIsRunning(true);
      rafRef.current = requestAnimationFrame(updateElapsed);
    }
  }, [elapsed, isRunning, updateElapsed]);

  const pause = useCallback(() => {
    if (isRunning && rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsRunning(false);
  }, [isRunning]);

  const reset = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsRunning(false);
    setElapsed(0);
    startTimeRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return { elapsed, isRunning, start, pause, reset };
}
