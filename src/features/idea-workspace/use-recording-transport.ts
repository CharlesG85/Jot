import { useEffect } from 'react';
import { useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';

export interface RecordingTransportResult {
  progress: SharedValue<number>;
  /**
   * Monotonically increasing beat count elapsed since recording started (0
   * on the first beat), or -1 whenever not recording. Derived from the exact
   * same frame clock and `recordingStartTime` anchor as `progress`, so a beat
   * number readout and `progress` can never disagree about where "now" is.
   */
  currentBeat: SharedValue<number>;
  /**
   * Position within the current beat, 0 (just landed on the beat) to just
   * under 1 (about to land on the next one), or 0 whenever not recording.
   * The one continuous signal the visual metronome (see
   * beat-pulse-envelope.ts) is built from — computed every frame from
   * elapsed time directly, not a retriggered animation, so it can't drift
   * from the recording clock even over a long take
   * (docs/07_AUDIO_ARCHITECTURE.md §15-16).
   */
  beatPhase: SharedValue<number>;
}

/**
 * Recording's transport. Unlike Playback, there is no single "audio engine
 * position" to synchronize to here — during recording the Recorder's own
 * polled state exists for the timer label and the loop-length auto-stop,
 * not as a position feed, and correcting a visual clock against it would
 * mean the user's own timing reference could pause or jump whenever that
 * poll happens to land awkwardly. So this transport doesn't reference the
 * Recorder at all: it runs entirely from its own high-resolution monotonic
 * clock (the UI thread's frame timestamps), advancing every display frame
 * with no pauses, jumps, or corrections applied. It *is* the timing
 * reference the user records against, rather than a reflection of one — see
 * docs/07_AUDIO_ARCHITECTURE.md §15-16 and useLayerRecorder's
 * recordingStartTimeRef, which timestamps the saved Layer against this same
 * clock (not the Recorder's own duration) so it lines up with what was on
 * screen while the take was performed.
 *
 * `currentBeat`/`beatPhase` are computed in this same per-frame worklet —
 * not a second timer — so the visual metronome reacting to them can never
 * drift relative to the progress indicator; all three read the same
 * `now`/`recordingStartTime`.
 */
export function useRecordingTransport(
  isRecording: boolean,
  loopDurationSeconds: number,
  beatDurationSeconds: number,
): RecordingTransportResult {
  const progress = useSharedValue(0);
  const currentBeat = useSharedValue(-1);
  const beatPhase = useSharedValue(0);
  const isRecordingShared = useSharedValue(isRecording);
  const wasRecording = useSharedValue(false);
  const recordingStartTime = useSharedValue(0);
  const loopDurationMillis = useSharedValue(loopDurationSeconds * 1000);
  const beatDurationMillis = useSharedValue(beatDurationSeconds * 1000);

  useEffect(() => {
    isRecordingShared.value = isRecording;
  }, [isRecording, isRecordingShared]);

  useEffect(() => {
    loopDurationMillis.value = loopDurationSeconds * 1000;
  }, [loopDurationSeconds, loopDurationMillis]);

  useEffect(() => {
    beatDurationMillis.value = beatDurationSeconds * 1000;
  }, [beatDurationSeconds, beatDurationMillis]);

  useFrameCallback((frameInfo) => {
    'worklet';
    const now = frameInfo.timestamp;
    const recording = isRecordingShared.value;

    // Edge-detected inside the worklet itself, on the same frame clock this
    // transport renders from — a JS-thread timestamp captured at the moment
    // `phase` changes to 'recording' isn't guaranteed to share an epoch with
    // the UI thread's frame timestamps, so it can't be used to anchor this
    // directly.
    if (recording && !wasRecording.value) {
      recordingStartTime.value = now;
    }
    wasRecording.value = recording;

    if (!recording) {
      progress.value = 0;
      currentBeat.value = -1;
      beatPhase.value = 0;
      return;
    }

    const elapsedMillis = now - recordingStartTime.value;

    const duration = loopDurationMillis.value;
    progress.value = duration > 0 ? Math.min(1, elapsedMillis / duration) : 0;

    const beatMillis = beatDurationMillis.value;
    if (beatMillis > 0) {
      currentBeat.value = Math.floor(elapsedMillis / beatMillis);
      beatPhase.value = (elapsedMillis % beatMillis) / beatMillis;
    } else {
      currentBeat.value = -1;
      beatPhase.value = 0;
    }
  });

  return { progress, currentBeat, beatPhase };
}
