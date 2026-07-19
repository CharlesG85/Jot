import { useMidiProcessingStore } from '@/features/idea-workspace/midi-processing-store';
import type { Idea } from '@/models/idea';
import { INSTRUMENT_DEFINITIONS } from '@/models/instrument';
import type { Layer } from '@/models/layer';
import type { MidiData } from '@/models/midi';
import { storageService } from '@/services/sqlite-storage-service';
import { LayerNotFoundError } from '@/services/storage-service';
import { renderMidiToPcm } from '@/utils/instrument-renderer';
import { getBarDurationSeconds } from '@/utils/loop-duration';
import { renderMidiToPcmFromSoundFont } from '@/utils/soundfont-renderer';
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

/**
 * Every one of these is something `renderMidiToPcm` actually reads (see
 * instrument-renderer.ts): `tempo` and `timeSignature` (via
 * getBarDurationSeconds) directly determine how each note's `startBeat`
 * converts to a sample position, and `loopLengthBars` determines the
 * render's total duration. Omitting any of them means a change to that
 * input goes undetected — the cache keeps serving an old render that no
 * longer matches, which is exactly how multiple Layers can end up rendered
 * at different effective tempos (each individually "valid" for whatever
 * tempo was current when *it* last rendered) and audibly drift apart
 * relative to each other, despite each one's own `midiData` being correct.
 */
function computeRenderFingerprint(
  layer: Pick<Layer, 'midiData' | 'instrument' | 'effectsIntensity' | 'loopLengthBars'>,
  idea: Pick<Idea, 'tempo' | 'timeSignature'>,
): string {
  return djb2Hash(
    `${layer.midiData ?? ''}|${layer.instrument ?? ''}|${layer.effectsIntensity}|${layer.loopLengthBars}|${idea.tempo}|${idea.timeSignature}`,
  );
}

/**
 * The Rendered Audio Cache: ensures a Layer's rendered instrument audio is
 * up to date with everything the render actually depends on — see
 * computeRenderFingerprint's own docstring for the exact list — calling the
 * Renderer only when one of those has actually changed since the last
 * successful render, otherwise reuses the existing file. The Renderer being
 * deterministic (see instrument-renderer.ts) is what makes a fingerprint
 * match a reliable signal that re-rendering is unnecessary, not just
 * probably fine.
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
    console.log('[midi-debug] stage 4: rendering skipped — missing midiData or instrument', {
      layerId: layer.id,
      hasMidiData: !!layer.midiData,
      instrument,
    });
    return;
  }

  const fingerprint = computeRenderFingerprint(layer, idea);
  if (layer.renderedAudioPath && layer.renderedAudioFingerprint === fingerprint) {
    console.log('[midi-debug] stage 4: rendering skipped — cache hit, reusing existing file', {
      layerId: layer.id,
      renderedAudioPath: layer.renderedAudioPath,
    });
    return;
  }

  const definition = INSTRUMENT_DEFINITIONS[instrument];

  useMidiProcessingStore.getState().start(layer.id, 'rendering');
  try {
    const midiData: MidiData = JSON.parse(layer.midiData);
    const loopDurationSeconds = layer.loopLengthBars * getBarDurationSeconds(idea);

    // Dispatches on the definition's own renderMode — capability, not
    // instrument identity — so a future sampled instrument (strings,
    // guitar, ...) needs only its own SoundFontInstrumentDefinition, never
    // a change here (docs/03_ROADMAP.md Stage 9.5a).
    const renderStream =
      definition.renderMode === 'soundfont'
        ? renderMidiToPcmFromSoundFont(
            midiData,
            definition,
            SAMPLE_RATE,
            idea.tempo,
            loopDurationSeconds,
          )
        : renderMidiToPcm(midiData, definition, SAMPLE_RATE, idea.tempo, loopDurationSeconds);

    const chunks: Float32Array[] = [];
    for await (const chunk of renderStream) {
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
    console.log('[midi-debug] stage 4: rendered', {
      layerId: layer.id,
      instrument,
      rendered: true,
      renderedAudioPath,
      sampleCount: totalSamples,
      durationSeconds: totalSamples / SAMPLE_RATE,
    });
  } catch (error) {
    // Same benign race as convertLayerToMidi's catch in
    // midi-analysis-service.ts — rendering can take a while, and the user
    // deleting this Layer before it finishes means there's nothing left to
    // persist the render to, not a real failure.
    if (error instanceof LayerNotFoundError) {
      console.log('[midi-debug] stage 4: layer deleted before render finished', layer.id);
    } else {
      console.error('[midi-debug] stage 4: rendering threw', layer.id, error);
    }
  } finally {
    useMidiProcessingStore.getState().finish(layer.id);
  }
}
