import { createAudioPlayer, type AudioSample } from 'expo-audio';

import { useMidiProcessingStore } from '@/features/idea-workspace/midi-processing-store';
import type { Idea } from '@/models/idea';
import type { Layer } from '@/models/layer';
import { storageService } from '@/services/sqlite-storage-service';
import { logAudioLifecycle } from '@/utils/audio-lifecycle-logger';
import { convertPcmToMidi } from '@/utils/pitch-to-midi';

// Generous relative to the longest possible recording (8 bars) — a backstop
// against a stalled/never-finishing player leaking a capture forever, not a
// tuned value.
const CAPTURE_TIMEOUT_MS = 60_000;

interface PcmCapture {
  samples: Float32Array;
  sampleRate: number;
}

/**
 * Plays `audioPath` through once, muted, with audio sampling enabled, and
 * returns the decoded PCM (downmixed to mono if the source has more than
 * one channel).
 *
 * expo-audio has no standalone "decode this file to PCM" API. What it does
 * have is AudioPlayer.setAudioSamplingEnabled(), which taps the player's own
 * internal decode pipeline (an MTAudioProcessingTap on the underlying
 * AVPlayer) and emits real PCM frames via the `audioSampleUpdate` event — as
 * a side effect of actually playing the file. Muting (`volume = 0`) doesn't
 * affect the tapped data (confirmed by reading the native source: `volume`
 * maps to AVPlayer's own output-stage gain, downstream of the tap), but
 * this does mean capture takes as long as the recording's own duration to
 * complete, not an instant in-memory decode — an accepted tradeoff for a
 * background, fire-and-forget analysis pass.
 *
 * The native tap never actually computes `AudioSample.timestamp` (always
 * reports 0), so buffers can't be ordered by it — this relies on the
 * `audioSampleUpdate` events arriving in playback order instead, which
 * holds for straight-through playback with no seeking.
 */
function capturePcmSamples(audioPath: string): Promise<PcmCapture> {
  return new Promise((resolve, reject) => {
    const player = createAudioPlayer(audioPath);
    logAudioLifecycle('player', 'create', player.id, 'midi-analysis');
    const chunks: Float32Array[] = [];
    let totalSamples = 0;
    let settled = false;

    const timeoutId = setTimeout(() => {
      fail(new Error('MIDI analysis playback timed out'));
    }, CAPTURE_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timeoutId);
      sampleSubscription.remove();
      statusSubscription.remove();
      logAudioLifecycle('player', 'destroy', player.id, 'midi-analysis');
      player.remove();
    }

    function finish() {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();

      const samples = new Float32Array(totalSamples);
      let offset = 0;
      for (const chunk of chunks) {
        samples.set(chunk, offset);
        offset += chunk.length;
      }
      // The tap doesn't report a sample rate directly — derived from what
      // was actually captured against the player's own reported duration,
      // rather than assumed.
      const sampleRate = player.duration > 0 ? totalSamples / player.duration : 0;
      resolve({ samples, sampleRate });
    }

    function fail(error: unknown) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    }

    const sampleSubscription = player.addListener('audioSampleUpdate', (sample: AudioSample) => {
      const channelFrames = sample.channels.map((channel) => channel.frames);
      const frameCount = channelFrames[0]?.length ?? 0;
      if (frameCount === 0) {
        return;
      }
      const mono = new Float32Array(frameCount);
      for (let i = 0; i < frameCount; i++) {
        let sum = 0;
        for (const frames of channelFrames) {
          sum += frames[i];
        }
        mono[i] = sum / channelFrames.length;
      }
      chunks.push(mono);
      totalSamples += frameCount;
    });

    // Same completion gate as the Layer preview player (layer-card.tsx) —
    // `didJustFinish` alone can fire on a not-yet-loaded player before any
    // real playback has happened.
    const statusSubscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.error) {
        fail(new Error(status.error));
        return;
      }
      if (status.isLoaded && status.duration > 0 && status.didJustFinish) {
        finish();
      }
    });

    player.volume = 0;
    player.setAudioSamplingEnabled(true);
    logAudioLifecycle('player', 'play', player.id, 'midi-analysis');
    player.play();
  });
}

/**
 * Runs Stage 8's pitch-detection pipeline for a just-recorded Layer and
 * persists the result — a derived, additive analysis. `layer.audioPath`
 * (the original recording, saved exactly as expo-audio produced it) is
 * never modified; it's only played back internally, muted, to capture PCM
 * for analysis — see capturePcmSamples above.
 */
export async function convertLayerToMidi(layer: Layer, idea: Pick<Idea, 'tempo'>): Promise<void> {
  if (!layer.audioPath) {
    return;
  }

  useMidiProcessingStore.getState().start(layer.id, 'analyzing');
  try {
    const { samples, sampleRate } = await capturePcmSamples(layer.audioPath);
    if (samples.length === 0 || sampleRate <= 0) {
      console.warn('[midi-analysis] captured no usable samples', { layerId: layer.id });
      return;
    }

    const midiData = await convertPcmToMidi(samples, sampleRate, idea.tempo);
    await storageService.updateLayer(layer.id, { midiData: JSON.stringify(midiData) });
    console.log('[midi-analysis] converted', {
      layerId: layer.id,
      noteCount: midiData.notes.length,
      notes: midiData.notes,
    });
  } catch (error) {
    console.error('[midi-analysis] failed for layer', layer.id, error);
  } finally {
    useMidiProcessingStore.getState().finish(layer.id);
  }
}
