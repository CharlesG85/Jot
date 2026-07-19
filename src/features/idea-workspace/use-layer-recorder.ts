import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';

import { useCountIn } from '@/features/idea-workspace/use-count-in';
import type { Idea } from '@/models/idea';
import type { Layer } from '@/models/layer';
import { convertLayerToMidi } from '@/services/midi-analysis-service';
import { ensureLayerRenderCached } from '@/services/midi-render-service';
import type { RecordingPhase } from '@/services/audio-service';
import { logAudioLifecycle } from '@/utils/audio-lifecycle-logger';
import { storageService } from '@/services/sqlite-storage-service';
import {
  computeLoopLengthBars,
  getBarDurationSeconds,
  getLoopDurationSeconds,
} from '@/utils/loop-duration';

/** How often the recorder's elapsed duration is polled, in ms — used for the
 * live timer label and for detecting the Idea's full-loop hard stop. */
const DURATION_POLL_INTERVAL_MS = 500;

const FILE_STABILITY_POLL_INTERVAL_MS = 50;
const FILE_STABILITY_MAX_ATTEMPTS = 20;

/**
 * Waits until a file's size stops changing between two consecutive checks
 * (or a max wait elapses) — a proxy for "the native encoder has finished
 * flushing this file to disk," since recorder.stop() resolving doesn't
 * guarantee that on its own.
 */
async function waitForFileToStabilize(uri: string): Promise<void> {
  let previousSize = -1;
  for (let attempt = 0; attempt < FILE_STABILITY_MAX_ATTEMPTS; attempt++) {
    const size = new File(uri).size ?? 0;
    if (size > 0 && size === previousSize) {
      return;
    }
    previousSize = size;
    await new Promise((resolve) => setTimeout(resolve, FILE_STABILITY_POLL_INTERVAL_MS));
  }
}

interface UseLayerRecorderResult {
  phase: RecordingPhase;
  /** 1-4 while phase is 'counting-in', otherwise null. */
  countInBeat: number | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * Records a new Layer for an Idea. Recording always stops immediately when
 * requested — it never waits out a bar boundary (docs/03_ROADMAP.md Stage
 * 6.5, "Loop Interpretation"). The audio file is saved exactly as
 * performed; a separate `loopLengthBars` value (see
 * utils/loop-duration.ts's computeLoopLengthBars) is computed afterward
 * from the real recorded duration and stored as Layer metadata — that's
 * what the loop engine uses for looped Idea playback, not the file's own
 * length. Recording still hard-stops automatically at the Idea's full loop
 * length, same as before.
 *
 * If the Idea's metronome is enabled, a one-bar count-in
 * (docs/07_AUDIO_ARCHITECTURE.md §5) plays before the mic actually goes
 * live — never during, so the click can never bleed into the recording.
 */
export function useLayerRecorder(
  ideaId: string,
  idea: Pick<Idea, 'tempo' | 'timeSignature' | 'loopLengthBars' | 'metronomeEnabled'>,
  onLayerRecorded: (layer: Layer) => void,
  onLayerUpdated: (layer: Layer) => void,
): UseLayerRecorderResult {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, DURATION_POLL_INTERVAL_MS);
  const [phase, setPhase] = useState<RecordingPhase>('idle');
  const countIn = useCountIn(idea);
  // Captured on the same high-resolution monotonic clock
  // (performance.now()) the recording transport visually runs from — see
  // useRecordingTransport — so the stored Layer duration lines up with what
  // was actually on screen while it was recorded, rather than with the
  // Recorder's own independently-polled notion of elapsed time.
  const recordingStartTimeRef = useRef(0);

  // Instrumentation only — observes the create/destroy of the recorder this
  // hook already provides; does not create or manage the recorder itself.
  // The id is captured here rather than re-read inside the cleanup: the
  // underlying native object can already be released by the time cleanup
  // runs (its own release effect isn't ordered relative to ours), and
  // reading `recorder.id` again at that point throws.
  useEffect(() => {
    const recorderId = recorder.id;
    logAudioLifecycle('recorder', 'create', recorderId, 'layer-recorder');
    return () => {
      logAudioLifecycle('recorder', 'destroy', recorderId, 'layer-recorder');
    };
  }, [recorder.id]);

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

    if (idea.metronomeEnabled) {
      setPhase('counting-in');
      const completed = await countIn.start();
      if (!completed) {
        setPhase('idle');
        return;
      }
    }

    // Prepared immediately before recording starts, not before the count-in
    // — preparing that early left several real seconds of the count-in's
    // own click playback happening on the same audio session before
    // record() was ever called, which silently invalidated the prepared
    // recorder and produced a near-empty capture regardless of how long the
    // recording was actually held afterward.
    logAudioLifecycle('recorder', 'prepare', recorder.id, 'layer-recorder');
    await recorder.prepareToRecordAsync();

    logAudioLifecycle('recorder', 'record', recorder.id, 'layer-recorder');
    recorder.record();
    recordingStartTimeRef.current = performance.now();
    setPhase('recording');
  }

  async function performStop() {
    setPhase('processing');
    // From the recording transport's own clock (see recordingStartTimeRef
    // above), not the Recorder's polled duration — captured before stop(),
    // not after, for the same reason as that value would have been: reading
    // any time reference back out is unreliable once the recorder has
    // actually stopped.
    const rawDurationSeconds = (performance.now() - recordingStartTimeRef.current) / 1000;
    // The auto-stop below only fires on a 500ms poll (recorderState.durationMillis),
    // so real elapsed time can have crept slightly past the Idea's own loop
    // boundary by the time it's caught — but recording is documented to
    // always end exactly at that boundary (docs/07_AUDIO_ARCHITECTURE.md
    // §3, §6), so any such overshoot is poll lag, not a longer performance.
    // Clamping here is what keeps computeLoopLengthBars from rounding up to
    // the *next* allowed tier (e.g. a 4-bar Idea producing an 8-bar Layer)
    // purely because of a few hundred milliseconds of polling slop.
    const durationSeconds = Math.min(rawDurationSeconds, loopDurationSeconds);
    try {
      logAudioLifecycle('recorder', 'stop', recorder.id, 'layer-recorder');
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        throw new Error('Recording produced no file');
      }

      // recorder.stop() can resolve before the native encoder has actually
      // finished flushing the compressed audio to this file — reading it
      // immediately can capture a file that's technically complete (valid
      // container, correct headers) but holds only the first fraction of a
      // second of real audio. Wait for its size to stop changing first.
      await waitForFileToStabilize(uri);

      const loopLengthBars = computeLoopLengthBars(durationSeconds, barDurationSeconds);

      const existingLayers = await storageService.listLayers(ideaId);
      const layer = await storageService.createLayer(ideaId, {
        name: `Layer ${existingLayers.length + 1}`,
      });

      const bytes = await new File(uri).bytes();
      const savedPath = await storageService.saveRecording(layer.id, bytes);
      const updatedLayer = await storageService.updateLayer(layer.id, {
        audioPath: savedPath,
        durationSeconds,
        loopLengthBars,
      });
      await storageService.touchIdea(ideaId);

      onLayerRecorded(updatedLayer);

      // Fire-and-forget: MIDI analysis never blocks or fails the recording
      // flow itself — a conversion failure is only ever logged, never
      // surfaced to the user (see midi-analysis-service.ts). A freshly
      // recorded Layer always has `instrument: null`, so the render-cache
      // call below is a guaranteed no-op today (its own guard short-circuits
      // on that) — kept anyway so the cache stays correctly wired if MIDI
      // analysis is ever re-run against an existing, MIDI-enabled Layer.
      convertLayerToMidi(updatedLayer, idea, onLayerUpdated)
        .then(() => ensureLayerRenderCached(updatedLayer, idea, onLayerUpdated))
        .catch((error) => {
          console.error('[midi-analysis] unexpected failure', error);
        });
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

  // Stops immediately — no waiting for a bar boundary. The audio is saved
  // exactly as performed; performStop() separately computes how many bars
  // that maps to for playback purposes (see docs/03_ROADMAP.md Stage 6.5).
  async function stop() {
    if (phase === 'counting-in') {
      countIn.cancel();
      return;
    }
    if (phase !== 'recording') {
      return;
    }
    await performStop();
  }

  // Automatic hard stop once a recording reaches the Idea's full loop
  // length — unrelated to the user-initiated stop() above, which is always
  // immediate now. `performStop` is redefined every render; adding it to
  // deps would just make this run unconditionally, which isn't needed
  // since `phase`/`durationMillis` are the real triggers.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (phase !== 'recording') {
      return;
    }
    if (recorderState.durationMillis >= loopDurationSeconds * 1000) {
      performStop();
    }
  }, [phase, recorderState.durationMillis, loopDurationSeconds]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  return {
    phase,
    countInBeat: countIn.currentBeat,
    start,
    stop,
  };
}
