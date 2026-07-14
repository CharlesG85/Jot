import Pitchfinder from 'pitchfinder';

import type { MidiData, MidiNote } from '@/models/midi';

// Chosen so pitch detection sees a Nyquist rate well above humming's
// fundamental range (~1kHz) while keeping YIN's O(n^2) cost tractable on a
// mobile JS thread (roughly a 16x speedup at 4x decimation).
const DOWNSAMPLE_FACTOR = 4;
// Slots per beat — 4 = 16th notes.
const QUANTIZATION = 4;
const YIELD_EVERY_N_SLOTS = 8;
// A fixed, uncalibrated noise floor — a known tuning parameter, see
// docs/03_ROADMAP.md Stage 8 plan's "Known limitations".
const SILENCE_RMS_THRESHOLD = 0.02;
const MIN_NOTE_SLOTS = 2;
const MIN_MIDI_PITCH = 0;
const MAX_MIDI_PITCH = 127;

function downsample(samples: Float32Array, factor: number): Float32Array {
  const outLength = Math.floor(samples.length / factor);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    let sum = 0;
    for (let j = 0; j < factor; j++) {
      sum += samples[i * factor + j];
    }
    out[i] = sum / factor;
  }
  return out;
}

function slotSizeInSamples(sampleRate: number, tempo: number, quantization: number): number {
  return Math.max(1, Math.round((sampleRate * 60) / (quantization * tempo)));
}

function computeRms(samples: Float32Array): number {
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSquares += samples[i] * samples[i];
  }
  return Math.sqrt(sumSquares / samples.length);
}

function frequencyToMidiPitch(frequency: number): number {
  return Math.round(69 + 12 * Math.log2(frequency / 440));
}

/**
 * Radius-1 median filter: an isolated slot whose two neighbors agree with
 * each other (and disagree with it) gets replaced by them. This corrects
 * YIN's most common artifact on real sustained pitched audio — a momentary
 * octave/semitone slip on a single slot — before segmentation ever sees it;
 * without this, a single stray slot mid-note would fragment one note into
 * three.
 */
function medianFilterSlots(pitches: (number | null)[]): (number | null)[] {
  if (pitches.length < 3) {
    return pitches;
  }
  const filtered = pitches.slice();
  for (let i = 1; i < pitches.length - 1; i++) {
    const previous = pitches[i - 1];
    const current = pitches[i];
    const next = pitches[i + 1];
    if (previous !== null && previous === next && current !== previous) {
      filtered[i] = previous;
    }
  }
  return filtered;
}

interface Segment {
  pitch: number | null;
  startSlot: number;
  slotLength: number;
  rmsValues: number[];
}

function segmentSlots(pitches: (number | null)[], rms: number[]): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < pitches.length; i++) {
    const pitch = pitches[i];
    const last = segments[segments.length - 1];
    if (last && last.pitch === pitch) {
      last.slotLength += 1;
      last.rmsValues.push(rms[i]);
    } else {
      segments.push({ pitch, startSlot: i, slotLength: 1, rmsValues: [rms[i]] });
    }
  }
  return segments;
}

/**
 * Backstop for spurious runs the median filter doesn't catch (two
 * consecutive stray slots): merges any segment shorter than MIN_NOTE_SLOTS
 * into the segment before it, then re-coalesces any now-adjacent segments
 * that ended up sharing a pitch. A short *leading* segment (nothing before
 * it to absorb into) is left as-is — a known, accepted edge case for this
 * prototype-grade pass.
 */
function mergeShortSegments(segments: Segment[]): Segment[] {
  const merged: Segment[] = [];
  for (const segment of segments) {
    if (segment.slotLength >= MIN_NOTE_SLOTS || merged.length === 0) {
      merged.push({ ...segment, rmsValues: [...segment.rmsValues] });
      continue;
    }
    const previous = merged[merged.length - 1];
    previous.slotLength += segment.slotLength;
    previous.rmsValues.push(...segment.rmsValues);
  }

  const coalesced: Segment[] = [];
  for (const segment of merged) {
    const last = coalesced[coalesced.length - 1];
    if (last && last.pitch === segment.pitch) {
      last.slotLength += segment.slotLength;
      last.rmsValues.push(...segment.rmsValues);
    } else {
      coalesced.push(segment);
    }
  }
  return coalesced;
}

/**
 * Converts a mono PCM buffer into an internal MIDI representation — see
 * src/models/midi.ts and docs/03_ROADMAP.md Stage 8. A prototype-grade
 * pipeline, not full DSP correction: YIN pitch detection on a downsampled
 * copy of the signal, snapped to the nearest semitone (the "pitch
 * correction" step), gated to rests below a fixed silence threshold,
 * smoothed against YIN's most common artifact, then segmented into
 * discrete notes. Yields periodically so analysis doesn't block the JS
 * thread for its full duration in one synchronous stretch.
 */
export async function convertPcmToMidi(
  samples: Float32Array,
  sampleRate: number,
  tempo: number,
): Promise<MidiData> {
  if (samples.length === 0 || !Number.isFinite(tempo) || tempo <= 0) {
    return { notes: [] };
  }

  const analysisSampleRate = sampleRate / DOWNSAMPLE_FACTOR;
  const analysisSamples = downsample(samples, DOWNSAMPLE_FACTOR);
  const chunkSize = slotSizeInSamples(analysisSampleRate, tempo, QUANTIZATION);
  const slotCount = Math.ceil(analysisSamples.length / chunkSize);
  const detectPitch = Pitchfinder.YIN({ sampleRate: analysisSampleRate });

  const rawPitches: (number | null)[] = [];
  const rms: number[] = [];

  for (let slot = 0; slot < slotCount; slot++) {
    const start = slot * chunkSize;
    const end = Math.min(start + chunkSize, analysisSamples.length);
    let chunk = analysisSamples.subarray(start, end);
    if (chunk.length < chunkSize) {
      // Tail shorter than one full slot — zero-pad rather than dropping it,
      // so the last fraction of a recording still gets an analysis slot
      // (silence-padding naturally gates a true silent tail to a rest,
      // rather than it simply never being analyzed at all).
      const padded = new Float32Array(chunkSize);
      padded.set(chunk);
      chunk = padded;
    }

    const frequency = detectPitch(chunk);
    rawPitches.push(frequency === null ? null : frequencyToMidiPitch(frequency));
    rms.push(computeRms(chunk));

    if (slot % YIELD_EVERY_N_SLOTS === YIELD_EVERY_N_SLOTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  let maxRms = 0;
  for (const value of rms) {
    maxRms = Math.max(maxRms, value);
  }
  if (maxRms <= 0) {
    return { notes: [] };
  }

  const gatedPitches = rawPitches.map((pitch, index) =>
    rms[index] < SILENCE_RMS_THRESHOLD ? null : pitch,
  );
  const smoothedPitches = medianFilterSlots(gatedPitches);
  const segments = mergeShortSegments(segmentSlots(smoothedPitches, rms));

  const notes: MidiNote[] = [];
  for (const segment of segments) {
    if (segment.pitch === null) {
      continue;
    }
    const meanRms =
      segment.rmsValues.reduce((sum, value) => sum + value, 0) / segment.rmsValues.length;
    const velocity = Math.min(127, Math.max(1, Math.round((meanRms / maxRms) * 127)));
    notes.push({
      pitch: Math.min(MAX_MIDI_PITCH, Math.max(MIN_MIDI_PITCH, segment.pitch)),
      startBeat: segment.startSlot / QUANTIZATION,
      durationBeats: segment.slotLength / QUANTIZATION,
      velocity,
    });
  }

  return { notes };
}
