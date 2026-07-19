import { GeneratorType, type Key, type Range, type SoundFont2 } from 'soundfont2';

import type { SoundFontInstrumentDefinition } from '@/models/instrument';
import type { MidiData } from '@/models/midi';
import { softClip } from '@/utils/instrument-renderer';

// A fixed "medium" velocity used for every note, for both sample selection
// and amplitude — see findKeyData's docstring for why sample selection
// needs this too, not just gain. Deliberately not derived from a note's own
// velocity yet (docs/03_ROADMAP.md Stage 9.5a); real velocity-sensitive
// playback is future work, not this stage's.
const FIXED_VELOCITY = 90;

// Short, fixed fades — not a full SF2 volume envelope (no delay/hold/decay/
// sustain/release generators, no key/velocity scaling). The sample itself
// already carries a real piano's natural amplitude contour; this only
// exists to avoid a click at the exact sample boundaries this renderer
// introduces (an abrupt start, and an abrupt cut at the note's own
// duration) — see docs/03_ROADMAP.md Stage 9.5a's explicitly minimal scope.
const ATTACK_SECONDS = 0.005;
const RELEASE_SECONDS = 0.02;

/** SampleModes generator values (SF2 spec) — the only two this renderer distinguishes. */
const SAMPLE_MODE_NO_LOOP = 0;
const SAMPLE_MODE_LOOP_CONTINUOUS = 1;
const SAMPLE_MODE_LOOP_UNTIL_RELEASE = 3;

/**
 * Proportionally scales attack+release to fit inside a note shorter than
 * their combined length, then holds flat at 1.0 in between — same
 * proportional-scaling technique as instrument-renderer.ts's
 * envelopeGainAt (guarantees gain always reaches 0 by the note's last
 * sample, however short), simplified to two ramps with no decay/sustain
 * shaping, since the sample's own recorded decay already provides that.
 */
function fadeGainAt(sampleIndex: number, durationSamples: number, sampleRate: number): number {
  const attackSamplesRaw = ATTACK_SECONDS * sampleRate;
  const releaseSamplesRaw = RELEASE_SECONDS * sampleRate;
  const totalRaw = attackSamplesRaw + releaseSamplesRaw;
  const scale = totalRaw > durationSamples && totalRaw > 0 ? durationSamples / totalRaw : 1;
  const attackSamples = attackSamplesRaw * scale;
  const releaseSamples = releaseSamplesRaw * scale;
  const releaseStart = durationSamples - releaseSamples;

  if (sampleIndex < attackSamples) {
    return attackSamples > 0 ? sampleIndex / attackSamples : 1;
  }
  if (sampleIndex < releaseStart) {
    return 1;
  }
  const releaseProgress = releaseSamples > 0 ? (sampleIndex - releaseStart) / releaseSamples : 1;
  return Math.max(0, 1 - releaseProgress);
}

/**
 * Reads one linearly-interpolated sample at a fractional position in the
 * sample's own data array, looping between the SF2's loop points once
 * `loopEnabled` and playback reaches `loopEnd` — this is what lets a
 * sustained note outlast the raw (finite) recording. Returns null once
 * playback runs past the sample's natural end with no loop to fall back
 * on — silence, not an error.
 */
function readInterpolatedSample(
  data: Int16Array,
  position: number,
  loopStart: number,
  loopEnd: number,
  loopEnabled: boolean,
): number | null {
  let pos = position;
  if (loopEnabled && loopEnd > loopStart) {
    if (pos >= loopEnd) {
      const loopLength = loopEnd - loopStart;
      pos = loopStart + ((pos - loopStart) % loopLength);
    }
  } else if (pos >= data.length) {
    return null;
  }
  const index = Math.floor(pos);
  const frac = pos - index;
  const a = data[index] ?? 0;
  const b = index + 1 < data.length ? data[index + 1] : a;
  return (a * (1 - frac) + b * frac) / 32768;
}

/**
 * The pitch ratio to play `key`'s sample at so it sounds at `notePitch`
 * instead of its own recorded pitch — root key (or the OverridingRootKey
 * generator, when present) plus coarse/fine tune generators plus the
 * sample's own pitch-correction, all converted to cents and combined. Not
 * yet handled: ScaleTuning (assumed at its spec default of 100 — a full
 * semitone per MIDI key, which is what this formula already assumes).
 */
function computePlaybackRate(notePitch: number, key: Key): number {
  const overridingRootKey = key.generators[GeneratorType.OverridingRootKey]?.value;
  const rootKey =
    overridingRootKey !== undefined && overridingRootKey >= 0
      ? overridingRootKey
      : key.sample.header.originalPitch;
  const coarseTune = key.generators[GeneratorType.CoarseTune]?.value ?? 0;
  const fineTune = key.generators[GeneratorType.FineTune]?.value ?? 0;
  const totalCents =
    (notePitch - rootKey) * 100 + coarseTune * 100 + fineTune + key.sample.header.pitchCorrection;
  return Math.pow(2, totalCents / 1200);
}

/** InitialAttenuation is in centibels (1/10 dB) — converted to a linear gain multiplier. */
function computeAttenuationGain(key: Key): number {
  const centibels = key.generators[GeneratorType.InitialAttenuation]?.value ?? 0;
  return Math.pow(10, -(centibels / 10) / 20);
}

function isInRange(range: Range | undefined, value: number): boolean {
  return range === undefined || (range.lo <= value && range.hi >= value);
}

/**
 * Replaces soundfont2's own SoundFont2.getKeyData for zone selection.
 * getKeyData only ever filters zones by key range — it takes no velocity
 * argument at all, and its own docstring says as much ("does not process
 * any of the generators that are specific to the key number"). For a
 * velocity-layered instrument (soft/loud samples covering the same key
 * range via a VelRange generator, like this bundled piano), that means it
 * silently returns whichever velocity-layer zone happens to be listed
 * first in the SF2 file for a given key — a property of file ordering, not
 * of anything musical. Audibly, that reads as different notes randomly
 * switching between a soft and loud sample character, unrelated to how
 * they were actually performed.
 *
 * This mirrors getKeyData's own zone-matching/merging logic exactly, but
 * additionally filters both the preset and instrument zone by VelRange
 * against a single fixed velocity — every note gets a consistent,
 * deterministic sample choice.
 */
function findKeyData(
  soundFont: SoundFont2,
  keyNumber: number,
  bankNumber: number,
  presetNumber: number,
  velocity: number,
): Key | null {
  const preset = soundFont.banks[bankNumber]?.presets[presetNumber];
  if (!preset) {
    return null;
  }

  for (const presetZone of preset.zones) {
    if (!isInRange(presetZone.keyRange, keyNumber)) {
      continue;
    }
    if (!isInRange(presetZone.generators[GeneratorType.VelRange]?.range, velocity)) {
      continue;
    }

    for (const instrumentZone of presetZone.instrument.zones) {
      if (!isInRange(instrumentZone.keyRange, keyNumber)) {
        continue;
      }
      if (!isInRange(instrumentZone.generators[GeneratorType.VelRange]?.range, velocity)) {
        continue;
      }

      return {
        keyNumber,
        preset,
        instrument: presetZone.instrument,
        sample: instrumentZone.sample,
        generators: { ...presetZone.generators, ...instrumentZone.generators },
        modulators: { ...presetZone.modulators, ...instrumentZone.modulators },
      };
    }
  }

  return null;
}

function synthesizeSoundFontNote(
  buffer: Float32Array,
  startSample: number,
  durationSamples: number,
  notePitch: number,
  velocityGain: number,
  sampleRate: number,
  key: Key,
): void {
  if (durationSamples <= 0) {
    return;
  }

  const { data, header } = key.sample;
  const playbackRate = computePlaybackRate(notePitch, key);
  const attenuationGain = computeAttenuationGain(key);
  const sampleModes = key.generators[GeneratorType.SampleModes]?.value ?? SAMPLE_MODE_NO_LOOP;
  const loopEnabled =
    sampleModes === SAMPLE_MODE_LOOP_CONTINUOUS || sampleModes === SAMPLE_MODE_LOOP_UNTIL_RELEASE;
  // The sample may itself have been recorded at a different rate than the
  // render's own sampleRate — this ratio corrects for that independently
  // of the musical pitch-shift ratio above.
  const sourceRateRatio = header.sampleRate / sampleRate;

  for (let i = 0; i < durationSamples; i++) {
    const outputIndex = startSample + i;
    if (outputIndex < 0 || outputIndex >= buffer.length) {
      continue;
    }

    const sourcePosition = i * playbackRate * sourceRateRatio;
    const sampleValue = readInterpolatedSample(
      data,
      sourcePosition,
      header.startLoop,
      header.endLoop,
      loopEnabled,
    );
    if (sampleValue === null) {
      continue;
    }

    const gain = fadeGainAt(i, durationSamples, sampleRate) * velocityGain * attenuationGain;
    buffer[outputIndex] += sampleValue * gain;
  }
}

/**
 * The sample-based counterpart to instrument-renderer.ts's renderMidiToPcm
 * (docs/03_ROADMAP.md Stage 9.5a) — same signature shape, same
 * deterministic-by-construction guarantee (every output value derives
 * purely from `midiData`'s own notes and the bundled SoundFont's own fixed
 * bytes, no randomness or wall-clock reads), so it's a drop-in alternative
 * for whichever call site dispatches on InstrumentDefinition.renderMode —
 * see midi-render-service.ts's ensureLayerRenderCached.
 *
 * Deliberately minimal, per this stage's own scope: linear-interpolation
 * resampling (not cubic/sinc), a simple fixed attack/release fade (not the
 * SF2 spec's full volume-envelope generators), no modulators, no filters.
 * Notes overlapping in time (chords, or overlapping tails) mix correctly
 * regardless, since every note is additively accumulated into the same
 * buffer — polyphony isn't a special case here, just what addition already
 * does.
 */
export async function* renderMidiToPcmFromSoundFont(
  midiData: MidiData,
  definition: SoundFontInstrumentDefinition,
  sampleRate: number,
  tempo: number,
  durationSeconds: number,
): AsyncGenerator<Float32Array> {
  if (durationSeconds <= 0 || !Number.isFinite(tempo) || tempo <= 0) {
    yield new Float32Array(0);
    return;
  }

  const soundFont = await definition.loadSoundFont();
  const samplesPerBeat = (sampleRate * 60) / tempo;
  const totalSamples = Math.ceil(durationSeconds * sampleRate);
  const buffer = new Float32Array(totalSamples);

  const velocityGain = FIXED_VELOCITY / 127;

  for (const note of midiData.notes) {
    const key = findKeyData(
      soundFont,
      Math.round(note.pitch),
      definition.bank,
      definition.preset,
      FIXED_VELOCITY,
    );
    if (!key) {
      console.warn('[soundfont-renderer] no sample found for MIDI pitch', note.pitch);
      continue;
    }

    const startSample = Math.round(note.startBeat * samplesPerBeat);
    const durationSamples = Math.round(note.durationBeats * samplesPerBeat);
    synthesizeSoundFontNote(
      buffer,
      startSample,
      durationSamples,
      note.pitch,
      velocityGain,
      sampleRate,
      key,
    );
  }

  softClip(buffer);
  yield buffer;
}
