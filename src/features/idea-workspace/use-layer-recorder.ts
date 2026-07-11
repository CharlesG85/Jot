import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';

import { useCountIn } from '@/features/idea-workspace/use-count-in';
import type { Idea } from '@/models/idea';
import type { Layer } from '@/models/layer';
import type { RecordingPhase } from '@/services/audio-service';
import { storageService } from '@/services/sqlite-storage-service';
import { getBarDurationSeconds, getLoopDurationSeconds } from '@/utils/loop-duration';

/** How often the recorder's elapsed duration is polled, in ms — tighter than the
 * default 500ms so the bar-boundary stop lands reasonably close to it. */
const DURATION_POLL_INTERVAL_MS = 100;

/**
 * A stop request within this many seconds of a bar boundary is treated as
 * landing on it — otherwise every stop would wait out almost a full poll
 * tick even when the recorder is effectively already there.
 */
const BOUNDARY_TOLERANCE_SECONDS = 0.15;

interface UseLayerRecorderResult {
  phase: RecordingPhase;
  durationMillis: number;
  /** 1-4 while phase is 'counting-in', otherwise null. */
  countInBeat: number | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * Records a new Layer for an Idea. A recording's length always rounds to a
 * whole number of bars: original audio is never trimmed (see
 * docs/07_AUDIO_ARCHITECTURE.md §8, "Original recordings should always be
 * preserved"), so stopping mid-bar keeps recording for a moment longer until
 * the next bar boundary rather than cutting anything off. Recording also
 * hard-stops at the Idea's full loop length, same as before.
 *
 * If the Idea's metronome is enabled, a four-beat count-in
 * (docs/07_AUDIO_ARCHITECTURE.md §5) plays before the mic actually goes
 * live — never during, so the click can never bleed into the recording.
 */
export function useLayerRecorder(
  ideaId: string,
  idea: Pick<Idea, 'tempo' | 'timeSignature' | 'loopLengthBars' | 'metronomeEnabled'>,
  onLayerRecorded: (layer: Layer) => void,
): UseLayerRecorderResult {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, DURATION_POLL_INTERVAL_MS);
  const [phase, setPhase] = useState<RecordingPhase>('idle');
  const [pendingStopSeconds, setPendingStopSeconds] = useState<number | null>(null);
  const countIn = useCountIn(idea);

  const barDurationSeconds = getBarDurationSeconds(idea);
  const loopDurationSeconds = getLoopDurationSeconds(idea);

  async function start() {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Microphone Access Needed',
        'Jot needs microphone access to record. Enable it in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }

    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();

    if (idea.metronomeEnabled) {
      setPhase('counting-in');
      const completed = await countIn.start();
      if (!completed) {
        setPhase('idle');
        return;
      }
    }

    recorder.record();
    setPhase('recording');
  }

  async function performStop() {
    setPhase('processing');
    setPendingStopSeconds(null);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        throw new Error('Recording produced no file');
      }

      const existingLayers = await storageService.listLayers(ideaId);
      const layer = await storageService.createLayer(ideaId, {
        name: `Layer ${existingLayers.length + 1}`,
      });

      const bytes = await new File(uri).bytes();
      const savedPath = await storageService.saveRecording(layer.id, bytes);
      const updatedLayer = await storageService.updateLayer(layer.id, { audioPath: savedPath });
      await storageService.touchIdea(ideaId);

      onLayerRecorded(updatedLayer);
    } catch (error) {
      console.error('Failed to save recording', error);
      Alert.alert(
        'Recording Failed',
        'Something went wrong saving your recording. Please try again.',
      );
    } finally {
      setPhase('idle');
    }
  }

  // A recording's saved length always rounds to a whole bar — original audio
  // is never trimmed, so a stop request that lands mid-bar doesn't cut the
  // recording off immediately. Instead it keeps recording until the next bar
  // boundary, then stops for real (see performStop, called from the effect
  // below). Requests within BOUNDARY_TOLERANCE_SECONDS of a boundary just
  // stop right away rather than waiting out a whole extra poll tick.
  async function stop() {
    if (phase === 'counting-in') {
      countIn.cancel();
      return;
    }
    if (phase !== 'recording' || pendingStopSeconds !== null) {
      return;
    }

    const elapsedSeconds = recorderState.durationMillis / 1000;
    const nearestBar = Math.max(1, Math.round(elapsedSeconds / barDurationSeconds));
    let targetSeconds = Math.min(loopDurationSeconds, nearestBar * barDurationSeconds);
    if (targetSeconds < elapsedSeconds - BOUNDARY_TOLERANCE_SECONDS) {
      targetSeconds = Math.min(loopDurationSeconds, (nearestBar + 1) * barDurationSeconds);
    }

    if (targetSeconds <= elapsedSeconds + BOUNDARY_TOLERANCE_SECONDS) {
      await performStop();
    } else {
      setPendingStopSeconds(targetSeconds);
    }
  }

  // Reacts to the native recorder's own polled duration (an external system,
  // not state derived from props) to trigger performStop once either the
  // Idea's full loop boundary or a pending bar-quantized stop is reached —
  // so the "don't setState in an effect" and "include every reference in
  // deps" rules both assume a narrower pattern than this legitimate case.
  // `performStop` is redefined every render; adding it to deps would just
  // make this run unconditionally, which isn't needed since `phase`/
  // `durationMillis`/`pendingStopSeconds` are the real triggers.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (phase !== 'recording') {
      return;
    }
    const elapsedMillis = recorderState.durationMillis;
    if (elapsedMillis >= loopDurationSeconds * 1000) {
      performStop();
    } else if (pendingStopSeconds !== null && elapsedMillis >= pendingStopSeconds * 1000) {
      performStop();
    }
  }, [phase, recorderState.durationMillis, loopDurationSeconds, pendingStopSeconds]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  return {
    phase,
    durationMillis: recorderState.durationMillis,
    countInBeat: countIn.currentBeat,
    start,
    stop,
  };
}
