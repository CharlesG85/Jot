import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';

import type { Idea } from '@/models/idea';
import { getBeatsPerBar } from '@/utils/loop-duration';

interface PendingWait {
  timeoutId: ReturnType<typeof setTimeout>;
  resolve: (cancelled: boolean) => void;
}

interface UseCountInResult {
  /** 1 to the time signature's beat count while counting in, otherwise null. */
  currentBeat: number | null;
  /** Runs the count-in; resolves false if cancelled before it finished. */
  start: () => Promise<boolean>;
  cancel: () => void;
}

/**
 * Runs a tempo-spaced count-in before recording begins
 * (docs/07_AUDIO_ARCHITECTURE.md §5): a haptic tap and an on-screen beat
 * indicator, one beat per beat of the Idea's time signature (3 beats for
 * 3/4, 4 for 4/4, etc.) — always ending on the bar's downbeat, never
 * spilling into a second bar — with only the first beat accented (a
 * heavier haptic).
 *
 * No audio click plays during the count-in. That was tried and tuned
 * extensively, but audio playback timing on this stack never settled onto
 * the beat grid reliably even after eliminating every accumulating-drift
 * and quantization source we could find — whereas the haptic/visual timing
 * (built on the same underlying schedule below) has held up correctly.
 * Rather than keep chasing audio-specific timing, the count-in relies on
 * haptics and the visual beat indicator only.
 */
export function useCountIn(idea: Pick<Idea, 'tempo' | 'timeSignature'>): UseCountInResult {
  const [currentBeat, setCurrentBeat] = useState<number | null>(null);
  const cancelledRef = useRef(false);
  const pendingWaitRef = useRef<PendingWait | null>(null);

  const beatsPerBar = getBeatsPerBar(idea);
  const beatIntervalMs = (60 / idea.tempo) * 1000;

  /** Resolves once `targetTime` (an absolute Date.now()-scale timestamp) is
   * reached, or immediately with true if cancelled before or during the wait. */
  function waitUntil(targetTime: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (cancelledRef.current) {
        resolve(true);
        return;
      }
      const delay = Math.max(0, targetTime - Date.now());
      const timeoutId = setTimeout(() => {
        pendingWaitRef.current = null;
        resolve(false);
      }, delay);
      pendingWaitRef.current = { timeoutId, resolve };
    });
  }

  async function start(): Promise<boolean> {
    cancelledRef.current = false;
    // Every beat is scheduled against this one fixed start time, not
    // relative to when the previous beat's work happened to finish — so
    // per-beat overhead can't accumulate into drift across the sequence.
    const startTime = Date.now();

    for (let beat = 0; beat < beatsPerBar; beat++) {
      if (cancelledRef.current) {
        setCurrentBeat(null);
        return false;
      }

      const targetTime = startTime + beat * beatIntervalMs;
      const cancelled = await waitUntil(targetTime);
      if (cancelled) {
        setCurrentBeat(null);
        return false;
      }

      const isAccent = beat === 0;
      Haptics.impactAsync(
        isAccent ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light,
      );
      setCurrentBeat(beat + 1);
    }

    // One more beat-interval of silence after the last beat, so recording
    // starts a full beat after the downbeat rather than immediately
    // following it.
    const cancelledAfterLast = await waitUntil(startTime + beatsPerBar * beatIntervalMs);
    if (cancelledAfterLast) {
      return false;
    }

    setCurrentBeat(null);
    return true;
  }

  function cancel() {
    cancelledRef.current = true;
    const pending = pendingWaitRef.current;
    if (pending) {
      clearTimeout(pending.timeoutId);
      pendingWaitRef.current = null;
      pending.resolve(true);
    }
  }

  return { currentBeat, start, cancel };
}
