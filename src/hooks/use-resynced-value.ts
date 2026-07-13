import { useEffect, useLayoutEffect, useRef } from 'react';
import { Easing, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

// A stalled real source (e.g. playback stopping being polled without going
// through the null path) shouldn't produce a slow, crawling catch-up
// animation once it resumes — bound how long any single correction is
// allowed to take, independent of how long the real gap actually was.
const MAX_STEP_DURATION_MULTIPLIER = 4;

/**
 * Returns a Reanimated SharedValue that tracks `getRealValue()`, polled
 * every `resyncIntervalMs`. Between genuinely new samples it animates
 * smoothly (linear, on the UI thread) toward the most recent one instead of
 * jumping, but every new sample re-targets the animation to the actual
 * reported value — so it can interpolate for visual smoothness without ever
 * drifting from the real source indefinitely, the way an independently-run
 * animation or a `Date.now()`-based clock would.
 *
 * Sources are polled at `resyncIntervalMs`, but not all of them actually
 * produce a new value that often — e.g. a Recorder's reported duration only
 * ticks over every 500ms even if polled more frequently. Retargeting a
 * still-unchanged value every poll would look like a stutter (flat, then a
 * sudden burst once the real value finally moves). Instead, a poll that
 * returns the same value as last time is skipped entirely, leaving whatever
 * animation is already in flight to keep running; when the value *does*
 * change, the animation runs over however long that change actually took to
 * arrive (capped, so a genuinely stalled source can't produce a slow
 * crawl-to-catch-up once it resumes) — so motion stays paced to each
 * source's real update rate instead of assuming one fixed cadence.
 *
 * A sample lower than the previous one (a loop wrapping back to its start)
 * snaps immediately rather than animating backward across the loop
 * boundary. `getRealValue` returning null means there's currently nothing to
 * track, and resets to 0.
 *
 * `getRealValue` is read through a ref, not captured in the effect's
 * dependencies, so passing a new closure each render (as callers typically
 * will) doesn't tear down and recreate the polling interval.
 */
export function useResyncedValue(
  getRealValue: () => number | null,
  resyncIntervalMs: number,
): SharedValue<number> {
  const value = useSharedValue(0);
  const previousRef = useRef<number | null>(null);
  const lastChangeAtRef = useRef<number | null>(null);
  const getRealValueRef = useRef(getRealValue);
  useLayoutEffect(() => {
    getRealValueRef.current = getRealValue;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const real = getRealValueRef.current();
      const previous = previousRef.current;

      if (real === null) {
        if (previous !== null) {
          previousRef.current = null;
          value.value = 0;
        }
        return;
      }

      if (real === previous) {
        return;
      }

      const now = Date.now();
      const sinceLastChange =
        lastChangeAtRef.current === null ? null : now - lastChangeAtRef.current;
      lastChangeAtRef.current = now;
      previousRef.current = real;

      if (previous === null || real < previous) {
        value.value = real;
      } else {
        const duration = Math.min(
          sinceLastChange ?? resyncIntervalMs,
          resyncIntervalMs * MAX_STEP_DURATION_MULTIPLIER,
        );
        value.value = withTiming(real, { duration, easing: Easing.linear });
      }
    }, resyncIntervalMs);

    return () => clearInterval(interval);
  }, [resyncIntervalMs, value]);

  return value;
}
