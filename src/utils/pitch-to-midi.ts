import Pitchfinder from 'pitchfinder';

import type { MidiData, MidiNote } from '@/models/midi';

// Chosen so pitch detection sees a Nyquist rate well above humming's
// fundamental range (~1kHz) while keeping YIN's O(n^2) cost tractable on a
// mobile JS thread (roughly a 16x speedup at 4x decimation).
const DOWNSAMPLE_FACTOR = 4;

// Pitch tracking runs on a fixed time grid, independent of tempo — a 16th
// note at 60 BPM is 250ms, far too coarse to track humming's actual pitch
// movement. Windows overlap (WINDOW_MS > HOP_MS) since YIN needs several
// cycles of the lowest expected frequency to track reliably, which is
// longer than the hop itself.
const HOP_MS = 15;
const WINDOW_MS = 40;
const YIELD_EVERY_N_FRAMES = 20;

// How many consecutive frames a pitch deviation has to sustain before it's
// treated as a real note change rather than a passing blip/vibrato wobble.
const MIN_NOTE_MS = 60;
// How far (in semitones) a frame's pitch can drift from a region's own
// recent pitch and still count as "the same note."
const PITCH_STABILITY_SEMITONES = 0.6;
// Only the last few frames of a region are used as its comparison basis —
// long sustained notes drift slightly (breath, natural vibrato), so basing
// stability on the region's entire history would make it increasingly
// unresponsive to genuine slow pitch movement.
const RECENT_WINDOW_FRAMES = 8;

// An isolated frame within `radius` frames of context that lands almost
// exactly one octave from its neighbors is corrected into that octave —
// YIN's single most common failure mode on real monophonic input.
const OCTAVE_CORRECTION_RADIUS = 3;
const OCTAVE_JUMP_TOLERANCE_SEMITONES = 0.6;
const MEDIAN_FILTER_RADIUS = 2;

// Roughly E2-E6 — a practical hummable range across voice types. Frequencies
// outside this are rejected before they ever reach smoothing/segmentation,
// so a stray sibilance/noise detection can't seed a bogus note or drag a
// median filter off course.
const MIN_HUMMABLE_MIDI_PITCH = 40;
const MAX_HUMMABLE_MIDI_PITCH = 88;

// The silence threshold is relative to the recording's own estimated noise
// floor (a low percentile of its per-frame RMS), not a fixed constant — a
// quiet take's soft humming should never read as "silence" just because an
// absolute threshold was tuned for a louder one. The absolute floor only
// guards against a degenerate near-zero noise-floor estimate.
const NOISE_FLOOR_PERCENTILE = 0.15;
const SILENCE_MARGIN_MULTIPLIER = 3;
const ABSOLUTE_SILENCE_FLOOR = 0.001;
// However loud the noise-floor estimate above ends up, the threshold never
// exceeds this fraction of the recording's own peak RMS — see
// computeAdaptiveSilenceThreshold for why this matters.
const MAX_SILENCE_THRESHOLD_FRACTION = 0.2;

// Timing quantization grid — 4 = 16th notes. Applied only after note
// detection is complete (see quantizeNoteTiming), never during pitch
// analysis itself.
const QUANTIZE_GRID = 4;

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

function computeRms(samples: Float32Array): number {
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSquares += samples[i] * samples[i];
  }
  return Math.sqrt(sumSquares / samples.length);
}

/** Continuous (non-rounded) MIDI pitch — semitones are the natural unit for smoothing/averaging, since musical intervals are logarithmic in frequency. */
function frequencyToContinuousPitch(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / 440);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Estimates the recording's own background noise floor (a low percentile of
 * per-frame RMS — the quietest portions, assumed to be silence/room noise
 * rather than performance) and derives a silence threshold relative to it.
 *
 * The percentile alone breaks down for a recording with little or no true
 * silence in it (a fully sustained hum, or legato with no gaps) — the
 * "quietest 15%" is then just a slightly-quieter moment of the same
 * performance, not real background noise, so `* SILENCE_MARGIN_MULTIPLIER`
 * can land close to or above the performance's own level and gate
 * everything out. Capping the threshold relative to the recording's peak
 * RMS keeps it from ever approaching genuine performed content, regardless
 * of how little (or no) true silence the take actually contains.
 */
function computeAdaptiveSilenceThreshold(rms: number[], maxRms: number): number {
  if (rms.length === 0) {
    return ABSOLUTE_SILENCE_FLOOR;
  }
  const sorted = [...rms].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * NOISE_FLOOR_PERCENTILE));
  const noiseFloor = sorted[index];
  const threshold = Math.max(noiseFloor * SILENCE_MARGIN_MULTIPLIER, ABSOLUTE_SILENCE_FLOOR);
  return Math.min(threshold, maxRms * MAX_SILENCE_THRESHOLD_FRACTION);
}

/**
 * Corrects an isolated frame that lands almost exactly N octaves from its
 * surrounding context by shifting it back into the same octave, rather than
 * discarding it — this keeps the contour continuous for segmentation
 * instead of punching a hole in it. A frame with too little surrounding
 * context to judge (near either end of the recording) is left alone.
 */
function correctIsolatedOctaveJumps(contour: (number | null)[]): (number | null)[] {
  const corrected = contour.slice();
  for (let i = 0; i < contour.length; i++) {
    const value = contour[i];
    if (value === null) {
      continue;
    }
    const neighbors: number[] = [];
    for (let offset = -OCTAVE_CORRECTION_RADIUS; offset <= OCTAVE_CORRECTION_RADIUS; offset++) {
      if (offset === 0) {
        continue;
      }
      const neighborValue = contour[i + offset];
      if (neighborValue !== null && neighborValue !== undefined) {
        neighbors.push(neighborValue);
      }
    }
    if (neighbors.length < OCTAVE_CORRECTION_RADIUS) {
      continue;
    }
    const context = median(neighbors);
    const deviation = value - context;
    const nearestOctaveMultiple = Math.round(deviation / 12);
    if (
      nearestOctaveMultiple !== 0 &&
      Math.abs(deviation - nearestOctaveMultiple * 12) < OCTAVE_JUMP_TOLERANCE_SEMITONES
    ) {
      corrected[i] = value - nearestOctaveMultiple * 12;
    }
  }
  return corrected;
}

/**
 * Radius-`MEDIAN_FILTER_RADIUS` median filter over the continuous pitch
 * contour — removes brief semitone-scale glitches (a single mistracked
 * frame) while preserving genuine sustained pitch changes, since a real
 * note change persists across many frames and isn't an outlier within its
 * own neighborhood the way a single bad frame is. Operates only on already
 * non-null frames — silence/rejected frames stay null, never filled in.
 */
function medianFilterContour(contour: (number | null)[]): (number | null)[] {
  const filtered = contour.slice();
  for (let i = 0; i < contour.length; i++) {
    if (contour[i] === null) {
      continue;
    }
    const windowValues: number[] = [];
    for (let offset = -MEDIAN_FILTER_RADIUS; offset <= MEDIAN_FILTER_RADIUS; offset++) {
      const value = contour[i + offset];
      if (value !== null && value !== undefined) {
        windowValues.push(value);
      }
    }
    filtered[i] = median(windowValues);
  }
  return filtered;
}

interface Region {
  startFrame: number;
  endFrame: number;
  pitches: number[];
  rmsValues: number[];
}

function regionRecentPitch(region: { pitches: number[] }): number {
  const recent = region.pitches.slice(-RECENT_WINDOW_FRAMES);
  return median(recent);
}

/**
 * Segments the smoothed contour into stable pitch regions — the boundary
 * between two notes comes from a sustained pitch change, not from silence,
 * which is what makes legato humming (connected notes, no gap between them)
 * segmentable. A pitch deviation only becomes a confirmed transition once it
 * sustains for `minNoteFrames` — anything shorter (a blip, vibrato) gets
 * absorbed back into the current region instead of splitting it.
 */
function segmentIntoRegions(
  contour: (number | null)[],
  rms: number[],
  minNoteFrames: number,
): Region[] {
  const regions: Region[] = [];
  let current: Region | null = null;
  let candidate: Region | null = null;

  function closeCurrent() {
    if (current && current.pitches.length > 0) {
      regions.push(current);
    }
    current = null;
  }

  for (let i = 0; i < contour.length; i++) {
    const pitch = contour[i];

    if (pitch === null) {
      closeCurrent();
      candidate = null;
      continue;
    }

    if (current === null) {
      current = { startFrame: i, endFrame: i + 1, pitches: [pitch], rmsValues: [rms[i]] };
      continue;
    }

    const deviation = Math.abs(pitch - regionRecentPitch(current));
    if (deviation <= PITCH_STABILITY_SEMITONES) {
      current.pitches.push(pitch);
      current.rmsValues.push(rms[i]);
      current.endFrame = i + 1;
      candidate = null;
      continue;
    }

    // Deviates from the current region — grow or start a candidate for what
    // might be the next note, without committing to it yet.
    if (candidate && Math.abs(pitch - regionRecentPitch(candidate)) <= PITCH_STABILITY_SEMITONES) {
      candidate.pitches.push(pitch);
      candidate.rmsValues.push(rms[i]);
      candidate.endFrame = i + 1;
    } else {
      candidate = { startFrame: i, endFrame: i + 1, pitches: [pitch], rmsValues: [rms[i]] };
    }

    if (candidate.pitches.length >= minNoteFrames) {
      // The candidate has proven itself sustained — commit the transition.
      current.endFrame = candidate.startFrame;
      regions.push(current);
      current = candidate;
      candidate = null;
    }
  }

  // A candidate that never matured (recording ended mid-transition) is
  // ambiguous — fold it into the current region rather than dropping it,
  // so no analyzed time silently vanishes from the result.
  if (candidate && current) {
    current.pitches.push(...candidate.pitches);
    current.rmsValues.push(...candidate.rmsValues);
    current.endFrame = candidate.endFrame;
  }
  closeCurrent();

  return regions;
}

/** Converts real (seconds-based) notes to the beat grid and snaps start/duration to it — automatic quantization, applied only after note detection is complete. */
function quantizeNoteTiming(
  notes: { pitch: number; startSeconds: number; durationSeconds: number; velocity: number }[],
  tempo: number,
): MidiNote[] {
  const secondsPerBeat = 60 / tempo;
  const gridBeats = 1 / QUANTIZE_GRID;

  const quantized = notes
    .map((note) => {
      const startBeatRaw = note.startSeconds / secondsPerBeat;
      const endBeatRaw = (note.startSeconds + note.durationSeconds) / secondsPerBeat;
      const startBeat = Math.round(startBeatRaw / gridBeats) * gridBeats;
      const endBeat = Math.max(
        startBeat + gridBeats,
        Math.round(endBeatRaw / gridBeats) * gridBeats,
      );
      return {
        pitch: note.pitch,
        startBeat,
        durationBeats: endBeat - startBeat,
        velocity: note.velocity,
      };
    })
    .sort((a, b) => a.startBeat - b.startBeat);

  // Quantizing can push two adjacent notes' boundaries into overlap —
  // trim the earlier note back to where the next one now starts, rather
  // than leaving what should be sequential legato notes stacked on top of
  // each other.
  for (let i = 0; i < quantized.length - 1; i++) {
    const currentNote = quantized[i];
    const nextNote = quantized[i + 1];
    const currentEnd = currentNote.startBeat + currentNote.durationBeats;
    if (currentEnd > nextNote.startBeat) {
      currentNote.durationBeats = Math.max(gridBeats, nextNote.startBeat - currentNote.startBeat);
    }
  }

  // A brief, ambiguous stretch (e.g. an analysis window straddling a very
  // short glitch) can occasionally still produce more than one region for
  // what's really a single held note — if two neighbors land on the same
  // rounded pitch with little or no gap between them, treat them as one
  // note rather than surfacing a spurious split.
  const coalesced: MidiNote[] = [];
  for (const note of quantized) {
    const last = coalesced[coalesced.length - 1];
    if (
      last &&
      last.pitch === note.pitch &&
      note.startBeat <= last.startBeat + last.durationBeats + gridBeats
    ) {
      last.durationBeats = Math.max(
        last.durationBeats,
        note.startBeat + note.durationBeats - last.startBeat,
      );
    } else {
      coalesced.push({ ...note });
    }
  }

  return coalesced;
}

/**
 * Converts a mono PCM buffer into an internal MIDI representation — see
 * src/models/midi.ts and docs/03_ROADMAP.md Stage 8.
 *
 * Pipeline, deliberately staged so pitch detection and rhythm quantization
 * never conflate: (1) continuous fixed-interval pitch tracking, independent
 * of tempo; (2) reject implausible/silent frames; (3) smooth the pitch
 * contour (octave-jump correction + median filter); (4) segment into stable
 * regions from sustained pitch change, not silence — enabling legato;
 * (5) one representative pitch per region, rounded once; (6) quantize the
 * resulting notes' timing to the beat grid last.
 *
 * A prototype-grade pipeline optimized for monophonic humming, not
 * general-purpose transcription. Yields periodically so analysis doesn't
 * block the JS thread for its full duration in one synchronous stretch.
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
  const hopSamples = Math.max(1, Math.round((analysisSampleRate * HOP_MS) / 1000));
  const windowSamples = Math.max(hopSamples, Math.round((analysisSampleRate * WINDOW_MS) / 1000));
  const frameCount = Math.max(1, Math.ceil(analysisSamples.length / hopSamples));
  const detectPitch = Pitchfinder.YIN({ sampleRate: analysisSampleRate });

  const rawFrequencies: (number | null)[] = [];
  const rms: number[] = [];

  for (let frame = 0; frame < frameCount; frame++) {
    const start = frame * hopSamples;
    const end = Math.min(start + windowSamples, analysisSamples.length);
    let window = analysisSamples.subarray(start, end);
    if (window.length < windowSamples) {
      const padded = new Float32Array(windowSamples);
      padded.set(window);
      window = padded;
    }

    rawFrequencies.push(detectPitch(window));
    rms.push(computeRms(window));

    if (frame % YIELD_EVERY_N_FRAMES === YIELD_EVERY_N_FRAMES - 1) {
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

  const silenceThreshold = computeAdaptiveSilenceThreshold(rms, maxRms);

  const continuousPitches: (number | null)[] = rawFrequencies.map((frequency, i) => {
    if (frequency === null || rms[i] < silenceThreshold) {
      return null;
    }
    const pitch = frequencyToContinuousPitch(frequency);
    if (pitch < MIN_HUMMABLE_MIDI_PITCH || pitch > MAX_HUMMABLE_MIDI_PITCH) {
      return null;
    }
    return pitch;
  });

  const octaveCorrected = correctIsolatedOctaveJumps(continuousPitches);
  const smoothed = medianFilterContour(octaveCorrected);

  const minNoteFrames = Math.max(1, Math.ceil(MIN_NOTE_MS / HOP_MS));
  const regions = segmentIntoRegions(smoothed, rms, minNoteFrames);

  const rawNotes = regions.map((region) => {
    const representativePitch = Math.round(median(region.pitches));
    const meanRms =
      region.rmsValues.reduce((sum, value) => sum + value, 0) / region.rmsValues.length;
    const velocity = Math.min(127, Math.max(1, Math.round((meanRms / maxRms) * 127)));
    return {
      pitch: Math.min(127, Math.max(0, representativePitch)),
      startSeconds: (region.startFrame * hopSamples) / analysisSampleRate,
      durationSeconds: ((region.endFrame - region.startFrame) * hopSamples) / analysisSampleRate,
      velocity,
    };
  });

  return { notes: quantizeNoteTiming(rawNotes, tempo) };
}
