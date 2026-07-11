import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';

import type { Idea } from '@/models/idea';
import { getBeatsPerBar } from '@/utils/loop-duration';

const COUNT_IN_BEATS = 4;

/** How often the cancellation flag is polled while waiting out a beat, so
 * tapping cancel feels immediate rather than waiting out a whole beat. */
const CANCEL_POLL_INTERVAL_MS = 50;

interface UseCountInResult {
  /** 1-4 while counting in, otherwise null. */
  currentBeat: number | null;
  /** Runs the four-beat count-in; resolves false if cancelled before it finished. */
  start: () => Promise<boolean>;
  cancel: () => void;
}

/**
 * Plays a four-beat, tempo-spaced count-in with audio clicks and haptic
 * taps before recording begins (docs/07_AUDIO_ARCHITECTURE.md §5). Always
 * exactly four clicks regardless of time signature — "respecting" the time
 * signature is expressed through which clicks are accented (the downbeats),
 * not the click count.
 */
export function useCountIn(idea: Pick<Idea, 'tempo' | 'timeSignature'>): UseCountInResult {
  const [currentBeat, setCurrentBeat] = useState<number | null>(null);
  const cancelledRef = useRef(false);
  const clickPlayerRef = useRef<AudioPlayer | null>(null);
  const accentPlayerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    const clickPlayer = createAudioPlayer(require('@/assets/sounds/metronome-click.wav'));
    const accentPlayer = createAudioPlayer(require('@/assets/sounds/metronome-accent.wav'));
    clickPlayerRef.current = clickPlayer;
    accentPlayerRef.current = accentPlayer;
    return () => {
      clickPlayer.remove();
      accentPlayer.remove();
    };
  }, []);

  const beatsPerBar = getBeatsPerBar(idea);
  const beatIntervalMs = (60 / idea.tempo) * 1000;

  async function start(): Promise<boolean> {
    cancelledRef.current = false;

    for (let beat = 0; beat < COUNT_IN_BEATS; beat++) {
      if (cancelledRef.current) {
        setCurrentBeat(null);
        return false;
      }

      setCurrentBeat(beat + 1);
      const isAccent = beat % beatsPerBar === 0;
      const player = isAccent ? accentPlayerRef.current : clickPlayerRef.current;
      player?.seekTo(0);
      player?.play();
      Haptics.impactAsync(
        isAccent ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light,
      );

      const cancelled = await interruptibleSleep(beatIntervalMs, cancelledRef);
      if (cancelled) {
        setCurrentBeat(null);
        return false;
      }
    }

    setCurrentBeat(null);
    return true;
  }

  function cancel() {
    cancelledRef.current = true;
  }

  return { currentBeat, start, cancel };
}

/** Resolves early (returning true) if `cancelledRef` flips true during the wait. */
function interruptibleSleep(ms: number, cancelledRef: { current: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += CANCEL_POLL_INTERVAL_MS;
      if (cancelledRef.current) {
        clearInterval(interval);
        resolve(true);
      } else if (elapsed >= ms) {
        clearInterval(interval);
        resolve(false);
      }
    }, CANCEL_POLL_INTERVAL_MS);
  });
}
