import { CrepePitchDetector } from '@/utils/crepe-pitch-detector';
import type { MidiNote, RawMidiNote } from '@/models/midi';
import type { PitchDetector } from '@/utils/pitch-detector';

// Pitch tracking runs on a fixed time grid, independent of tempo — a 16th
// note at 60 BPM is 250ms, far too coarse to track humming's actual pitch
// movement. The window length itself is dictated by whichever PitchDetector
// is in use (see its own `frameSize`) — CREPE's is a fixed model contract,
// not a tunable analysis parameter the way it was when this pipeline only
// ever ran YIN.
const HOP_MS = 15;
const YIELD_EVERY_N_FRAMES = 20;

// The single "musical intent" grain size: how long a deviation has to
// persist before it's believed as real, rather than a transitional voice
// glide or a passing dropout. Drives three related but distinct things in
// segmentIntoRegions/quantizeNoteTiming: (1) how long a pitch-change
// candidate — whether starting a note from silence, or deviating from an
// already-sounding one — must stay stable before it replaces the current
// note; (2) how long a run of silent/rejected frames must persist before an
// already-sounding note is actually considered to have ended, rather than
// just dipped in confidence/amplitude; (3) a final floor applied to
// quantized note durations, merging anything that still ends up shorter
// than this into a neighbor. Kept as one constant rather than three because
// the user-facing concept really is singular — "how short can a real note
// be" — and splitting it into independently-tunable knobs would let them
// drift out of sync for no behavioral benefit asked for.
const MIN_NOTE_DURATION_MS = 100;
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

/**
 * General linear-interpolation resample to an arbitrary target rate —
 * needed because different PitchDetector implementations require different
 * fixed sample rates (CREPE: exactly 16000Hz regardless of source; YIN:
 * whatever it's configured for), and the ratio between a recording's actual
 * rate and either of those is rarely an integer. No anti-aliasing filter:
 * humming's fundamental range (~1kHz) sits far enough below either
 * detector's Nyquist rate that this is acceptable for pitch tracking, even
 * if it wouldn't be for general-purpose audio resampling.
 */
function resampleTo(samples: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (sourceRate === targetRate) {
    return samples;
  }
  const ratio = sourceRate / targetRate;
  const outLength = Math.max(1, Math.floor(samples.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const sourceIndex = i * ratio;
    const indexFloor = Math.floor(sourceIndex);
    const indexCeil = Math.min(indexFloor + 1, samples.length - 1);
    const fraction = sourceIndex - indexFloor;
    out[i] = samples[indexFloor] * (1 - fraction) + samples[indexCeil] * fraction;
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
 * segmentable.
 *
 * Both directions of state change go through the same "candidate must prove
 * itself" gate, `minNoteFrames` wide:
 *
 *  - Starting a note (from silence, or deviating from an already-sounding
 *    one) never commits immediately — it grows a `candidate` region first.
 *    If the pitch drifts back to matching the still-current note before the
 *    candidate matures, the candidate is simply discarded (dropped on the
 *    next iteration where the deviating pitch stops matching it and instead
 *    matches `current` again) — this is what stops a voice's natural glide
 *    into a note from registering as its own short note.
 *  - Ending a note applies the same hysteresis in reverse: a run of
 *    null/rejected frames doesn't close `current` the instant it starts —
 *    only once the run itself reaches `minNoteFrames` is the note actually
 *    considered over. A brief confidence/amplitude dropout shorter than
 *    that is invisible to the output: `current.endFrame` simply jumps past
 *    the gap once real pitch resumes, so the note's rendered duration spans
 *    the dropout seamlessly rather than being split in two.
 *
 * A still-unmatured trailing candidate (recording ended mid-transition) is
 * folded into `current` rather than dropped, so no analyzed time silently
 * vanishes from the result — same as before this redesign.
 */
function segmentIntoRegions(
  contour: (number | null)[],
  rms: number[],
  minNoteFrames: number,
): Region[] {
  const regions: Region[] = [];
  let current: Region | null = null;
  let candidate: Region | null = null;
  let silenceRun = 0;

  function closeCurrent() {
    if (current && current.pitches.length > 0) {
      regions.push(current);
    }
    current = null;
  }

  function withinTolerance(pitch: number, region: Region): boolean {
    return Math.abs(pitch - regionRecentPitch(region)) <= PITCH_STABILITY_SEMITONES;
  }

  for (let i = 0; i < contour.length; i++) {
    const pitch = contour[i];

    if (pitch === null) {
      // A candidate is inherently provisional — it hasn't earned enough
      // stable evidence to be trusted yet, so a gap in the middle of
      // forming one invalidates it rather than pausing it.
      candidate = null;

      if (current === null) {
        continue;
      }
      silenceRun += 1;
      if (silenceRun >= minNoteFrames) {
        // The silence has itself persisted long enough to be believed as a
        // real note ending, not a dropout.
        closeCurrent();
        silenceRun = 0;
      }
      continue;
    }

    silenceRun = 0;

    if (current === null) {
      // No committed note yet — this is a candidate note onset, subject to
      // the exact same stability gate as a mid-recording pitch change (see
      // the docstring above). Without this, the very first non-null frame
      // of a recording used to become the note instantly, with no chance
      // to reject the settling-in glide at a hum's start.
      if (candidate && withinTolerance(pitch, candidate)) {
        candidate.pitches.push(pitch);
        candidate.rmsValues.push(rms[i]);
        candidate.endFrame = i + 1;
      } else {
        candidate = { startFrame: i, endFrame: i + 1, pitches: [pitch], rmsValues: [rms[i]] };
      }
      if (candidate.pitches.length >= minNoteFrames) {
        current = candidate;
        candidate = null;
      }
      continue;
    }

    if (withinTolerance(pitch, current)) {
      // Matches the ongoing note — including immediately after a tolerated
      // silence gap, in which case this jumps `endFrame` past the gap,
      // making the note span it seamlessly. Any candidate that was still
      // trying to prove itself is now moot: the pitch came back home.
      current.pitches.push(pitch);
      current.rmsValues.push(rms[i]);
      current.endFrame = i + 1;
      candidate = null;
      continue;
    }

    // Deviates from the current region — grow or start a candidate for what
    // might be the next note, without committing to it yet.
    if (candidate && withinTolerance(pitch, candidate)) {
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

/**
 * Final safety net, applied after quantization: segmentIntoRegions' own
 * hysteresis already guarantees every region it emits spans at least
 * `MIN_NOTE_DURATION_MS`, but snapping to the beat grid and the overlap
 * trim above can still shrink a note's *quantized* duration below that
 * floor (e.g. a short note squeezed between two grid points at a fast
 * tempo). Anything that ends up too short here is merged into whichever
 * *adjacent* neighbor is closer in pitch — the more likely candidate for
 * "the real note this fragment actually belongs to" — extending that
 * neighbor's span to cover it.
 *
 * "Adjacent" is deliberately checked (same tolerance as the coalescing pass
 * above) rather than assumed: a short note can legitimately sit between two
 * real notes separated by an actual rest, and blindly extending a neighbor
 * to cover a short note's span would silently swallow that rest. A short
 * note with no adjacent neighbor at all — isolated by real gaps on both
 * sides, or the only note in the whole recording — is left as-is rather
 * than discarded: a brief but genuine, isolated utterance losing its only
 * note to a duration floor is a worse outcome than showing a short one.
 */
function enforceMinimumNoteDuration(
  notes: MidiNote[],
  minDurationBeats: number,
  gridBeats: number,
): MidiNote[] {
  const result = notes.map((note) => ({ ...note }));

  for (let i = 0; i < result.length; i++) {
    if (result[i].durationBeats >= minDurationBeats) {
      continue;
    }
    const short = result[i];
    const prev = result[i - 1];
    const next = result[i + 1];

    const prevAdjacent =
      prev !== undefined && short.startBeat <= prev.startBeat + prev.durationBeats + gridBeats;
    const nextAdjacent =
      next !== undefined && next.startBeat <= short.startBeat + short.durationBeats + gridBeats;

    if (!prevAdjacent && !nextAdjacent) {
      continue;
    }

    const mergeIntoPrev =
      prevAdjacent &&
      (!nextAdjacent || Math.abs(prev.pitch - short.pitch) <= Math.abs(next.pitch - short.pitch));

    if (mergeIntoPrev) {
      prev.durationBeats = short.startBeat + short.durationBeats - prev.startBeat;
    } else {
      next.durationBeats = next.startBeat + next.durationBeats - short.startBeat;
      next.startBeat = short.startBeat;
    }
    result.splice(i, 1);
    // Re-examine the merged-into neighbor (now at this same index, or the
    // previous one) in case the merge itself needs re-checking — and to
    // correctly continue the scan after the splice shifted every later index.
    i -= 1;
  }

  return result;
}

/**
 * Converts real (seconds-based) notes to the beat grid and snaps
 * start/duration to it — automatic quantization, applied only after note
 * detection is complete. `gridBeats` is caller-supplied (see
 * utils/quantize-grid.ts) rather than fixed, so re-quantizing an already-
 * detected recording to a different grid (a Layer's `quantization` setting
 * changing) never needs to re-run pitch detection — this function is pure
 * and cheap, safe to call again anytime with the same `rawMidiData` and a
 * different `gridBeats`.
 */
export function quantizeNoteTiming(
  notes: RawMidiNote[],
  tempo: number,
  gridBeats: number,
): MidiNote[] {
  const secondsPerBeat = 60 / tempo;

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

  const minDurationBeats = MIN_NOTE_DURATION_MS / 1000 / secondsPerBeat;
  const result = enforceMinimumNoteDuration(coalesced, minDurationBeats, gridBeats);

  console.log('[midi-debug] stage 3: quantization', {
    gridBeats,
    noteCount: result.length,
    notes: result,
  });

  return result;
}

/**
 * Detects notes from a mono PCM buffer — see src/models/midi.ts and
 * docs/03_ROADMAP.md Stage 8. Returns raw, real-time-based notes
 * (`RawMidiNote`, seconds not beats) — quantization to a beat grid is
 * deliberately not part of this function at all (see quantizeNoteTiming);
 * pitch detection is by far the expensive part of this pipeline (it's the
 * one stage that needs the CREPE model), while quantization is pure,
 * tempo/grid-dependent arithmetic — keeping them fully separate is what
 * lets a Layer's `quantization` setting change be applied cheaply, from the
 * already-detected `rawMidiData`, without ever re-running detection.
 *
 * Pipeline, deliberately staged so pitch detection and rhythm quantization
 * never conflate: (1) continuous fixed-interval pitch tracking via a
 * pluggable PitchDetector (see pitch-detector.ts), independent of tempo;
 * (2) reject implausible/silent frames; (3) smooth the pitch contour
 * (octave-jump correction + median filter); (4) segment into stable regions
 * from sustained pitch change, not silence — enabling legato, and with
 * hysteresis on both onset and ending so a voice's natural glide into/out
 * of a note and brief confidence dropouts don't register as their own
 * short notes (see segmentIntoRegions); (5) one representative pitch per
 * region, rounded once.
 *
 * Everything from stage (2) onward is detector-agnostic — it operates on
 * `rawFrequencies`/`rms` arrays with no knowledge of which PitchDetector
 * produced them. Defaults to CrepePitchDetector; YinPitchDetector remains
 * available (same interface) for direct comparison.
 *
 * A prototype-grade pipeline optimized for monophonic humming, not
 * general-purpose transcription. Yields periodically so analysis doesn't
 * block the JS thread for its full duration in one synchronous stretch.
 */
export async function detectNotesFromPcm(
  samples: Float32Array,
  sampleRate: number,
  detector: PitchDetector = new CrepePitchDetector(),
): Promise<RawMidiNote[]> {
  if (samples.length === 0) {
    return [];
  }

  const analysisSampleRate = detector.sampleRate;
  const analysisSamples = resampleTo(samples, sampleRate, analysisSampleRate);
  console.log('[midi-debug] resampling', {
    sourceSampleRate: sampleRate,
    targetSampleRate: analysisSampleRate,
    resampleRatio: sampleRate / analysisSampleRate,
    sourceSampleCount: samples.length,
    resampledSampleCount: analysisSamples.length,
  });
  const hopSamples = Math.max(1, Math.round((analysisSampleRate * HOP_MS) / 1000));
  const windowSamples = detector.frameSize;
  const frameCount = Math.max(1, Math.ceil(analysisSamples.length / hopSamples));

  const rawFrequencies: (number | null)[] = [];
  const confidences: number[] = [];
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

    const { frequency, confidence } = await detector.detectPitch(window);
    rawFrequencies.push(frequency);
    confidences.push(confidence);
    rms.push(computeRms(window));

    if (frame % YIELD_EVERY_N_FRAMES === YIELD_EVERY_N_FRAMES - 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  console.log('[midi-debug] stage 1: detector output', {
    detector: detector.constructor.name,
    frameCount: rawFrequencies.length,
    avgConfidence: confidences.reduce((sum, c) => sum + c, 0) / (confidences.length || 1),
    first20: rawFrequencies
      .slice(0, 20)
      .map((frequency, i) => ({ frequency, confidence: confidences[i] })),
  });

  let maxRms = 0;
  for (const value of rms) {
    maxRms = Math.max(maxRms, value);
  }
  if (maxRms <= 0) {
    console.log('[midi-debug] bailing out: maxRms <= 0 (no audio energy at all)');
    return [];
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

  console.log('[midi-debug] intermediate: silence/plausibility gate', {
    maxRms,
    silenceThreshold,
    framesSurvivingGate: continuousPitches.filter((p) => p !== null).length,
    totalFrames: continuousPitches.length,
  });

  const octaveCorrected = correctIsolatedOctaveJumps(continuousPitches);
  const smoothed = medianFilterContour(octaveCorrected);

  const minNoteFrames = Math.max(1, Math.ceil(MIN_NOTE_DURATION_MS / HOP_MS));
  const regions = segmentIntoRegions(smoothed, rms, minNoteFrames);

  console.log('[midi-debug] stage 2: segmentation', {
    regionCount: regions.length,
    regions: regions.map((region) => ({
      pitch: Math.round(median(region.pitches)),
      durationMs: ((region.endFrame - region.startFrame) * hopSamples * 1000) / analysisSampleRate,
    })),
  });

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

  return rawNotes;
}
