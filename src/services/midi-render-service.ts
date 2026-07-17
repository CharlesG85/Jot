import { useMidiProcessingStore } from '@/features/idea-workspace/midi-processing-store';
import type { Idea } from '@/models/idea';
import { INSTRUMENT_DEFINITIONS } from '@/models/instrument';
import type { Layer } from '@/models/layer';
import type { MidiData } from '@/models/midi';
import { storageService } from '@/services/sqlite-storage-service';
import { renderMidiToPcm } from '@/utils/instrument-renderer';
import { getBarDurationSeconds } from '@/utils/loop-duration';
import { encodeWavPcm16 } from '@/utils/wav-encoder';

const SAMPLE_RATE = 44100;

/** Fast, non-cryptographic string hash (djb2) — for cache-key comparison only, not security. */
function djb2Hash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function computeRenderFingerprint(
  layer: Pick<Layer, 'midiData' | 'instrument' | 'effectsIntensity'>,
): string {
  return djb2Hash(`${layer.midiData ?? ''}|${layer.instrument ?? ''}|${layer.effectsIntensity}`);
}

/**
 * The Rendered Audio Cache: ensures a Layer's rendered instrument audio is
 * up to date with its current `(midiData, instrument, effectsIntensity)`,
 * calling the Renderer only when those inputs have actually changed since
 * the last successful render — otherwise reuses the existing file. The
 * Renderer being deterministic (see instrument-renderer.ts) is what makes a
 * fingerprint match a reliable signal that re-rendering is unnecessary, not
 * just probably fine.
 *
 * Idempotent and cheap on a cache hit (one hash comparison) — safe to call
 * from every point that touches those three inputs without needing to
 * precisely track "did anything actually change."
 *
 * This only writes the result to storage — it has no way to know whether
 * some component's in-memory copy of this Layer needs updating too, since
 * it runs as a plain background call, not a hook. `onLayerUpdated`, if
 * given, is called with the fresh Layer once a real (non-cache-hit) render
 * is persisted, so a caller can sync its own state.
 */
export async function ensureLayerRenderCached(
  layer: Layer,
  idea: Pick<Idea, 'tempo' | 'timeSignature' | 'loopLengthBars'>,
  onLayerUpdated?: (layer: Layer) => void,
): Promise<void> {
  const instrument = layer.instrument;
  if (!layer.midiData || !instrument) {
    return;
  }

  const fingerprint = computeRenderFingerprint(layer);
  if (layer.renderedAudioPath && layer.renderedAudioFingerprint === fingerprint) {
    return;
  }

  const definition = INSTRUMENT_DEFINITIONS[instrument];

  useMidiProcessingStore.getState().start(layer.id, 'rendering');
  try {
    const midiData: MidiData = JSON.parse(layer.midiData);
    const loopDurationSeconds = layer.loopLengthBars * getBarDurationSeconds(idea);

    const chunks: Float32Array[] = [];
    for await (const chunk of renderMidiToPcm(
      midiData,
      definition,
      SAMPLE_RATE,
      idea.tempo,
      loopDurationSeconds,
    )) {
      chunks.push(chunk);
    }

    let totalSamples = 0;
    for (const chunk of chunks) {
      totalSamples += chunk.length;
    }
    const samples = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }

    const wavBytes = encodeWavPcm16(samples, SAMPLE_RATE);
    const renderedAudioPath = await storageService.saveRenderedAudio(layer.id, wavBytes);
    const updated = await storageService.updateLayer(layer.id, {
      renderedAudioPath,
      renderedAudioFingerprint: fingerprint,
    });
    onLayerUpdated?.(updated);
    console.log('[midi-render] rendered', {
      layerId: layer.id,
      instrument,
      sampleCount: totalSamples,
    });
  } catch (error) {
    console.error('[midi-render] failed for layer', layer.id, error);
  } finally {
    useMidiProcessingStore.getState().finish(layer.id);
  }
}
