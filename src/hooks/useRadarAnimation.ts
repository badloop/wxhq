import { useEffect, useRef } from 'react';

/**
 * Drives a frame-based animation loop by dispatching frame index updates.
 * When `active` is true and `frameCount` > 0, runs a setInterval that
 * calls `onFrame` with the next frame index each tick.
 */
export function useRadarAnimation(
  active: boolean,
  frameCount: number,
  speed: number,
  currentFrame: number,
  onFrame: (frame: number) => void,
) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentRef = useRef(currentFrame);
  currentRef.current = currentFrame;

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;

    if (!active || frameCount === 0) return;

    intervalRef.current = setInterval(() => {
      const next = (currentRef.current + 1) % frameCount;
      onFrame(next);
    }, speed);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, frameCount, speed, onFrame]);
}
