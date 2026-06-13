import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

interface MoneyCounterProps {
  /** The current value to display (e.g. a £M amount). */
  value: number;
  /** Optional starting value for a one-shot count-up on mount (e.g. the
   *  pre-match balance, so a post-match receipt rolls up to the new total). */
  from?: number;
  /** Render the number — defaults to `£{n}M`. */
  format?: (n: number) => string;
  className?: string;
  durationMs?: number;
}

/**
 * A number that counts up/down to its target instead of snapping — the marquee
 * "modern feel" beat for money changes (bankroll on a signing/sale, the
 * matchday receipt total). Pure presentation; reduced-motion safe (snaps).
 */
export default function MoneyCounter({
  value,
  from,
  format = (n) => `£${n}M`,
  className,
  durationMs = 600,
}: MoneyCounterProps) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(from ?? value);
  // Tracks the currently-rendered number so an interrupted tween resumes from
  // where it visually is, not from a stale target.
  const fromRef = useRef(from ?? value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const start = fromRef.current;
    if (start === value) return;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic — quick, then settles
      const v = Math.round(start + (value - start) * eased);
      setDisplay(v);
      fromRef.current = v;
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, reduce, durationMs]);

  return <span className={className}>{format(display)}</span>;
}
