import { useState, useEffect, useRef, useCallback } from 'react';
import type { RadarFrame } from '../types/radar';

export function useRadarAnimation(frames: RadarFrame[], speed: number) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  useEffect(() => {
    if (!isPlaying || frames.length === 0) { stop(); return; }
    intervalRef.current = setInterval(() => {
      setCurrentFrame(f => (f + 1) % frames.length);
    }, speed);
    return stop;
  }, [isPlaying, frames.length, speed, stop]);

  useEffect(() => { setCurrentFrame(0); setIsPlaying(false); }, [frames]);

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const stepForward = useCallback(() => setCurrentFrame(f => (f + 1) % Math.max(frames.length, 1)), [frames.length]);
  const stepBack = useCallback(() => setCurrentFrame(f => (f - 1 + frames.length) % Math.max(frames.length, 1)), [frames.length]);

  return { currentFrame, isPlaying, play, pause, stepForward, stepBack, setCurrentFrame };
}
