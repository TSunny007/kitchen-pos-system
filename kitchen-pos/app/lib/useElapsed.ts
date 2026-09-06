"use client";

import { useEffect, useState } from "react";

/**
 * Milliseconds since `since`, re-measured on an interval.
 *
 * Reading the clock during render is impure and gives a value that silently
 * goes stale, so the measurement lives in an effect. Returns `null` until the
 * first measurement lands - callers should render nothing rather than show a
 * placeholder, since "0ms elapsed" on a twenty-minute-old order is worse than
 * a blank for one frame.
 */
export function useElapsedMs(since: string, intervalMs = 30_000): number | null {
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    const startedAt = new Date(since).getTime();
    const tick = () => setElapsed(Date.now() - startedAt);

    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [since, intervalMs]);

  return elapsed;
}
