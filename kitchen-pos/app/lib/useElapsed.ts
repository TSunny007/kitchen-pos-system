"use client";

import { useEffect, useState } from "react";

// One shared 30s tick for every card on screen, rather than an interval per
// card. The Recent Orders list appends 10 orders per "load more" without
// unmounting the previous ones, so per-card timers add up quickly.
const TICK_MS = 30_000;
const subscribers = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  if (timer === null) {
    timer = setInterval(() => subscribers.forEach((f) => f()), TICK_MS);
  }
  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/**
 * Milliseconds since `since`, re-measured on a shared interval.
 *
 * Reading the clock during render is impure and gives a value that silently
 * goes stale, so the measurement lives in an effect. Returns `null` until the
 * first measurement lands - callers should render nothing rather than show a
 * placeholder, since "0ms elapsed" on a twenty-minute-old order is worse than
 * a blank for one frame.
 *
 * Pass `enabled: false` for cards whose elapsed value isn't displayed (a
 * finished order shows its fixed prep duration instead); they then neither
 * subscribe nor re-render.
 */
export function useElapsedMs(since: string, enabled = true): number | null {
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const startedAt = new Date(since).getTime();
    const tick = () => setElapsed(Date.now() - startedAt);

    tick();
    return subscribe(tick);
  }, [since, enabled]);

  return enabled ? elapsed : null;
}
