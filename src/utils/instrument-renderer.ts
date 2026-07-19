import type { SynthInstrumentDefinition } from '@/models/instrument';
import type { MidiData } from '@/models/midi';

/** Inverse of pitch-to-midi.ts's frequencyToMidiPitch. */
export function midiPitchToFrequency(pitch: number): number {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}

function envelopeGainAt(
  sampleIndex: number,
  durationSamples: number,
  envelope: SynthInstrumentDefinition['envelope'],
  sampleRate: number,
): number {
  const attackSamplesRaw = envelope.attackSeconds * sampleRate;
  const decaySamplesRaw = envelope.decaySeconds * sampleRate;
  const releaseSamplesRaw = envelope.releaseSeconds * sampleRate;
  const totalRaw = attackSamplesRaw + decaySamplesRaw + releaseSamplesRaw;

  // A note shorter than its instrument's full attack+decay+release (a real,
  // common case — automatic quantization and the minimum-note-duration
  // floor both operate on musical/rhythmic grounds, with no awareness of
  // any particular instrument's envelope timing) has all three phases
  // scaled down by the same ratio here, rather than truncating release —
  // release not completing within the note's own bounds leaves a nonzero
  // gain right at the cutoff, an audible click, which scaling avoids
  // unconditionally: gain always reaches exactly 0 by the note's last
  // sample, however short. Scaling all three phases together (not just
  // release) rather than prioritizing release above attack/decay also
  // keeps a — compressed, but present — attack ramp for very short notes,
  // instead of trading a click at the end for a discontinuity at the start.
  const scale = totalRaw > durationSamples && totalRaw > 0 ? durationSamples / totalRaw : 1;
  const attackSamples = attackSamplesRaw * scale;
  const decaySamples = decaySamplesRaw * scale;
  const releaseSamples = releaseSamplesRaw * scale;
  const releaseStart = durationSamples - releaseSamples;

  if (sampleIndex < attackSamples) {
    return attackSamples > 0 ? sampleIndex / attackSamples : 1;
  }
  if (sampleIndex < attackSamples + decaySamples) {
    const decayProgress = decaySamples > 0 ? (sampleIndex - attackSamples) / decaySamples : 1;
    return 1 - decayProgress * (1 - envelope.sustainLevel);
  }
  if (sampleIndex < releaseStart) {
    return envelope.sustainLevel;
  }
  const releaseProgress = releaseSamples > 0 ? (sampleIndex - releaseStart) / releaseSamples : 1;
  return envelope.sustainLevel * Math.max(0, 1 - releaseProgress);
}

/**
 * Adds one note's envelope-shaped, additively-synthesized waveform into
 * `buffer` at the given sample offset. Reads only from `definition` — no
 * per-instrument branching lives here, which is what lets the Renderer stay
 * generic across every current and future Instrument Definition.
 */
function synthesizeNote(
  buffer: Float32Array,
  startSample: number,
  durationSamples: number,
  frequency: number,
  velocityGain: number,
  sampleRate: number,
  definition: SynthInstrumentDefinition,
): void {
  if (durationSamples <= 0) {
    return;
  }
  const partialAmplitudeSum = definition.partials.reduce(
    (sum, partial) => sum + partial.amplitude,
    0,
  );
  if (partialAmplitudeSum <= 0) {
    return;
  }

  for (let i = 0; i < durationSamples; i++) {
    const outputIndex = startSample + i;
    if (outputIndex < 0 || outputIndex >= buffer.length) {
      continue;
    }
    const t = i / sampleRate;
    let raw = 0;
    for (const partial of definition.partials) {
      raw += partial.amplitude * Math.sin(2 * Math.PI * frequency * partial.multiple * t);
    }
    const envelopeGain = envelopeGainAt(i, durationSamples, definition.envelope, sampleRate);
    buffer[outputIndex] += (raw / partialAmplitudeSum) * envelopeGain * velocityGain;
  }
}

/**
 * Scales the buffer down (never up) so its peak never exceeds 1 — a safety
 * net, not a loudness normalizer. Exported for reuse by
 * soundfont-renderer.ts, which needs the exact same safety net after
 * mixing possibly-many simultaneous sampled notes.
 */
export function softClip(buffer: Float32Array): void {
  let peak = 0;
  for (let i = 0; i < buffer.length; i++) {
    peak = Math.max(peak, Math.abs(buffer[i]));
  }
  if (peak <= 1) {
    return;
  }
  const scale = 1 / peak;
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] *= scale;
  }
}

/**
 * The Renderer — generic and instrument-agnostic: consumes MidiData and an
 * InstrumentDefinition, produces PCM. Never switches on an instrument ID;
 * every voice-specific decision comes from `definition` alone, so adding a
 * new instrument never requires touching this function.
 *
 * Deterministic by construction: every output value derives purely from
 * `midiData`'s own note values and `definition`'s fixed parameters — no
 * randomness, no wall-clock reads, notes processed in the array order
 * `midiData.notes` already has. Identical inputs always produce identical
 * output, which is what makes fingerprint-based render caching sound (see
 * midi-render-service.ts).
 *
 * Chunk-based (`AsyncGenerator`) rather than a single whole-buffer return,
 * specifically so this can support streaming/incremental rendering later
 * without a signature change — this first implementation computes the
 * entire buffer eagerly and yields it as one chunk, but every caller
 * already consumes it as a stream.
 */
export async function* renderMidiToPcm(
  midiData: MidiData,
  definition: SynthInstrumentDefinition,
  sampleRate: number,
  tempo: number,
  durationSeconds: number,
): AsyncGenerator<Float32Array> {
  if (durationSeconds <= 0 || !Number.isFinite(tempo) || tempo <= 0) {
    yield new Float32Array(0);
    return;
  }

  const samplesPerBeat = (sampleRate * 60) / tempo;
  const totalSamples = Math.ceil(durationSeconds * sampleRate);
  const buffer = new Float32Array(totalSamples);

  for (const note of midiData.notes) {
    const startSample = Math.round(note.startBeat * samplesPerBeat);
    const durationSamples = Math.round(note.durationBeats * samplesPerBeat);
    const frequency = midiPitchToFrequency(note.pitch);
    const velocityGain = note.velocity / 127;
    synthesizeNote(
      buffer,
      startSample,
      durationSamples,
      frequency,
      velocityGain,
      sampleRate,
      definition,
    );
  }

  softClip(buffer);
  yield buffer;
}
