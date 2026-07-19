import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { usePlaybackTransport } from '@/features/idea-workspace/use-playback-transport';
import { useRecordingTransport } from '@/features/idea-workspace/use-recording-transport';
import type { RecordingPhase } from '@/services/audio-service';

interface UseTransportProgressOptions {
  phase: RecordingPhase;
  loopDurationSeconds: number;
  beatDurationSeconds: number;
  getIdeaPlaybackProgress: () => number | null;
}

export interface TransportProgressResult {
  progress: SharedValue<number>;
  /** See RecordingTransportResult.currentBeat — only recording produces beats today. */
  recordingBeat: SharedValue<number>;
  /** See RecordingTransportResult.beatPhase — only recording produces beats today. */
  recordingBeatPhase: SharedValue<number>;
}

/**
 * The Transport: a single source of truth for "where are we in the current
 * musical loop," built from two deliberately distinct synchronization
 * models rather than one shared clock (see docs/07_AUDIO_ARCHITECTURE.md
 * §15-16):
 *
 * - Playback (usePlaybackTransport) predicts forward from the audio
 *   engine's latest known position every display frame, and is gently
 *   corrected — never snapped — as fresher real samples arrive.
 * - Recording (useRecordingTransport) ignores the audio engine entirely and
 *   runs off its own independent monotonic clock, since there's no single
 *   "position" to synchronize to and the whole point is an unpausing visual
 *   reference to record against.
 *
 * Both hooks self-gate to 0 when inactive, and recording/playback are
 * mutually exclusive in this app's UI (the Record and Play controls disable
 * each other), so summing them is equivalent to picking whichever one is
 * currently live.
 *
 * Interactive UI (Record/Play buttons, taps) does not consume this — it
 * stays on plain `phase`/`isPlaying` React state.
 */
export function useTransportProgress({
  phase,
  loopDurationSeconds,
  beatDurationSeconds,
  getIdeaPlaybackProgress,
}: UseTransportProgressOptions): TransportProgressResult {
  const recording = useRecordingTransport(
    phase === 'recording',
    loopDurationSeconds,
    beatDurationSeconds,
  );
  const playbackProgress = usePlaybackTransport(getIdeaPlaybackProgress, loopDurationSeconds);

  const progress = useDerivedValue(() => recording.progress.value + playbackProgress.value);

  return {
    progress,
    recordingBeat: recording.currentBeat,
    recordingBeatPhase: recording.beatPhase,
  };
}
