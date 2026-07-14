import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  Easing,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

// How often a fresh real sample is pulled from the audio engine. Prediction
// smoothness no longer depends on this being fast — every display frame
// predicts on its own — so this only needs to be quick enough to keep
// long-term drift imperceptible.
const SAMPLE_INTERVAL_MS = 200;
// Kept under SAMPLE_INTERVAL_MS so one correction settles before the next
// sample retriggers it, rather than perpetually overlapping.
const CORRECTION_DURATION_MS = 180;

function mod1(x: number): number {
  'worklet';
  return x - Math.floor(x);
}

/**
 * Playback's transport. The audio engine is the single source of truth, but
 * the transport is never rendered directly from its discrete position
 * samples — a sample only ever tells you where the audio *was* at the
 * moment it was read, so rendering straight from it is visibly steppy no
 * matter how often it's polled.
 *
 * Instead: every display frame predicts the current position forward from
 * the most recent real sample, at a constant tempo-derived rate, using the
 * UI thread's own high-resolution monotonic frame clock
 * (`frameInfo.timestamp`) — never a JS-thread `Date.now()`. When a new real
 * sample arrives, it isn't used to jump the rendered position — its error
 * against what was just predicted is computed, then absorbed by gently
 * easing a small correction offset out over CORRECTION_DURATION_MS,
 * continuous with whatever was already on screen. Long-running playback
 * therefore stays tightly locked to the real audio position without ever
 * visibly pausing, jumping, or drifting. See
 * docs/07_AUDIO_ARCHITECTURE.md §15-16.
 *
 * `getRealProgress` returning null (nothing currently playing) resets the
 * transport to 0 and clears the anchor, so the next real sample snaps
 * instead of being treated as a correction against stale state.
 */
export function usePlaybackTransport(
  getRealProgress: () => number | null,
  loopDurationSeconds: number,
): SharedValue<number> {
  const progress = useSharedValue(0);
  const realSample = useSharedValue<number | null>(null);
  const lastSeenSample = useSharedValue<number | null>(null);
  const hasAnchor = useSharedValue(false);
  const anchorPosition = useSharedValue(0);
  const anchorTime = useSharedValue(0);
  const correctionOffset = useSharedValue(0);
  // Loop fraction covered per millisecond — constant for the duration of a
  // playback session (tempo/loop length don't change mid-playback), derived
  // rather than measured, since measuring it from noisy samples would be
  // both less accurate and unnecessary.
  const rate = useSharedValue(loopDurationSeconds > 0 ? 1 / (loopDurationSeconds * 1000) : 0);

  useEffect(() => {
    rate.value = loopDurationSeconds > 0 ? 1 / (loopDurationSeconds * 1000) : 0;
  }, [loopDurationSeconds, rate]);

  const getRealProgressRef = useRef(getRealProgress);
  useLayoutEffect(() => {
    getRealProgressRef.current = getRealProgress;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      realSample.value = getRealProgressRef.current();
    }, SAMPLE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [realSample]);

  useFrameCallback((frameInfo) => {
    'worklet';
    const now = frameInfo.timestamp;
    const sample = realSample.value;

    if (sample === null) {
      if (hasAnchor.value) {
        hasAnchor.value = false;
        lastSeenSample.value = null;
        progress.value = 0;
      }
      return;
    }

    if (sample !== lastSeenSample.value) {
      lastSeenSample.value = sample;

      if (!hasAnchor.value) {
        // Nothing to correct from yet — this is where playback started.
        anchorPosition.value = sample;
        anchorTime.value = now;
        correctionOffset.value = 0;
        hasAnchor.value = true;
      } else {
        const predicted = mod1(
          anchorPosition.value + (now - anchorTime.value) * rate.value + correctionOffset.value,
        );
        // Circular difference — a sample just after a loop wrap looks like
        // a huge jump as a plain subtraction, but is actually a tiny error.
        let error = sample - predicted;
        if (error > 0.5) {
          error -= 1;
        } else if (error < -0.5) {
          error += 1;
        }
        anchorPosition.value = sample;
        anchorTime.value = now;
        // Rebasing the anchor to the fresh sample would otherwise step the
        // rendered value by `error` right now — cancel that instantly, then
        // ease it back out, so the correction is felt as a change in speed
        // over CORRECTION_DURATION_MS rather than a jump.
        correctionOffset.value = -error;
        correctionOffset.value = withTiming(0, {
          duration: CORRECTION_DURATION_MS,
          easing: Easing.out(Easing.quad),
        });
      }
    }

    progress.value = mod1(
      anchorPosition.value + (now - anchorTime.value) * rate.value + correctionOffset.value,
    );
  });

  return progress;
}
