import type { SharedValue } from 'react-native-reanimated';

import { useResyncedValue } from '@/hooks/use-resynced-value';
import type { RecordingPhase } from '@/services/audio-service';

// Frequent enough that a resync correction is never visible as a jump, rare
// enough not to add meaningful overhead — each tick is one Map lookup and
// one native `.currentTime` read, not a re-render (see useResyncedValue).
const RESYNC_INTERVAL_MS = 150;

interface UseTransportProgressOptions {
  phase: RecordingPhase;
  isPlaying: boolean;
  recordingDurationMillis: number;
  loopDurationSeconds: number;
  getIdeaPlaybackProgress: () => number | null;
}

/**
 * The Transport: a single source of truth for "where are we in the current
 * musical loop," sourced from whichever native audio engine is currently
 * authoritative — the Recorder while recording, the Idea's active players
 * while playing back — never from an independently-computed JS clock (see
 * docs/07_AUDIO_ARCHITECTURE.md §15-16).
 *
 * There is no single native object that means "position in the Idea's
 * loop": the Recorder has one clock while recording, and during Idea
 * playback there are N independently-looping native players, potentially
 * with different loop lengths each. So "the audio engine" here means
 * whichever real source is authoritative for the current phase —
 * `recordingDurationMillis` (already genuine native-polled data from
 * useLayerRecorder) while recording, `getIdeaPlaybackProgress()` (a
 * snapshot of one reference Layer's real player position, reconstructed
 * across its own loop repeats — see useIdeaPlayback) while playing.
 *
 * Interactive UI (Record/Play buttons, taps) does not consume this — it
 * stays on plain `phase`/`isPlaying` React state, which is why those two
 * still appear as ordinary props here rather than being folded in.
 *
 * The returned SharedValue is meant for Timeline today, and any future
 * playback-position UI (playhead, waveform progress, MIDI playback).
 */
export function useTransportProgress({
  phase,
  isPlaying,
  recordingDurationMillis,
  loopDurationSeconds,
  getIdeaPlaybackProgress,
}: UseTransportProgressOptions): SharedValue<number> {
  function getRealPosition(): number | null {
    if (phase === 'recording') {
      if (loopDurationSeconds <= 0) {
        return null;
      }
      return Math.min(1, recordingDurationMillis / (loopDurationSeconds * 1000));
    }
    if (isPlaying) {
      return getIdeaPlaybackProgress();
    }
    return null;
  }

  return useResyncedValue(getRealPosition, RESYNC_INTERVAL_MS);
}
