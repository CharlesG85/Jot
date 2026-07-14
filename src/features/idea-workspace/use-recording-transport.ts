import { useEffect } from 'react';
import { useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';

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
 */
export function useRecordingTransport(
  isRecording: boolean,
  loopDurationSeconds: number,
): SharedValue<number> {
  const progress = useSharedValue(0);
  const isRecordingShared = useSharedValue(isRecording);
  const wasRecording = useSharedValue(false);
  const recordingStartTime = useSharedValue(0);
  const loopDurationMillis = useSharedValue(loopDurationSeconds * 1000);

  useEffect(() => {
    isRecordingShared.value = isRecording;
  }, [isRecording, isRecordingShared]);

  useEffect(() => {
    loopDurationMillis.value = loopDurationSeconds * 1000;
  }, [loopDurationSeconds, loopDurationMillis]);

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
      return;
    }

    const duration = loopDurationMillis.value;
    progress.value = duration > 0 ? Math.min(1, (now - recordingStartTime.value) / duration) : 0;
  });

  return progress;
}
