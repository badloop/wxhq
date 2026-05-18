import { useEffect, useRef } from 'react';

/**
 * Drives a frame-based animation loop using requestAnimationFrame for smooth timing.
 * When `active` is true and `frameCount` > 0, advances frames at the given speed.
 * `loopDelay` adds an extra pause (ms) on the last frame before looping.
 */
export function useRadarAnimation(
  active: boolean,
  frameCount: number,
  speed: number,
  currentFrame: number,
  onFrame: (frame: number) => void,
  loopDelay: number = 0,
) {
  const rafRef = useRef<number | null>(null);
  const currentRef = useRef(currentFrame);
  const lastTickRef = useRef(0);
  currentRef.current = currentFrame;

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTickRef.current = 0;

    if (!active || frameCount === 0) return;

    const tick = (now: number) => {
      if (lastTickRef.current === 0) {
        lastTickRef.current = now;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const cur = currentRef.current;
      // Dwell on the last frame (most recent) before looping back
      const delay = cur === frameCount - 1 ? speed + loopDelay : speed;
      const elapsed = now - lastTickRef.current;

      if (elapsed >= delay) {
        const next = (cur + 1) % frameCount;
        onFrame(next);
        lastTickRef.current = now;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, frameCount, speed, loopDelay, onFrame]);
}
