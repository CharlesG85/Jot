import type { InstrumentId } from '@/models/instrument';

/**
 * A Layer is a single musical performance within an Idea (melody, harmony,
 * bass line, etc). Layers inherit tempo/time signature/loop length from
 * their parent Idea and never have independent timing.
 */

export type EffectsIntensity = 'off' | 'low' | 'medium' | 'high';

/** How finely a Layer's detected notes are snapped to the beat grid — see utils/quantize-grid.ts. */
export type QuantizeGrid = 'half' | 'one' | 'two' | 'bar';

export interface Layer {
  id: string;
  ideaId: string;
  name: string;
  instrument: InstrumentId | null;
  muted: boolean;
  solo: boolean;
  volume: number;
  audioPath: string | null;
  /** The exact length of the original recording, in seconds — never altered after recording. */
  durationSeconds: number;
  /**
   * How many bars this Layer occupies during looped Idea playback — always
   * one of 1, 2, 4, or 8 (docs/03_ROADMAP.md Stage 6.5). Independent of
   * `durationSeconds`: playback loops on this, not on the audio file's own
   * length, so a recording shorter than its loop length repeats silently
   * until the boundary, and one longer than its loop length restarts early
   * without the underlying file ever being trimmed.
   */
  loopLengthBars: number;
  /**
   * A JSON-serialized `MidiData` (see src/models/midi.ts), produced by
   * Stage 8's pitch-detection pipeline — null until analyzed, or if
   * analysis failed (see midi-analysis-service.ts). Purely derived,
   * additive data — `audioPath`'s original recording is never touched by
   * this; it's only played back internally (muted) to capture PCM samples.
   */
  midiData: string | null;
  /**
   * A JSON-serialized `RawMidiData` (see src/models/midi.ts) — the same
   * pitch-detection pass's notes *before* quantization, in seconds rather
   * than beats. Kept alongside `midiData` so changing `quantization` can
   * cheaply re-snap this recording's already-detected notes to a new grid
   * without re-running pitch detection. Null until analyzed, same as
   * `midiData`.
   */
  rawMidiData: string | null;
  /** Whether playback should use the rendered instrument audio instead of the original recording (Stage 9). */
  midiEnabled: boolean;
  /** Path to the cached rendered instrument audio — derived, regenerable, never authoritative. See midi-render-service.ts. */
  renderedAudioPath: string | null;
  /**
   * A fingerprint of the `(midiData, instrument, effectsIntensity)` the
   * current `renderedAudioPath` was generated from — compared against the
   * Layer's current values to decide whether the cached render is still
   * valid. See midi-render-service.ts.
   */
  renderedAudioFingerprint: string | null;
  /** UI-only for now — not yet applied to rendered audio. See docs/03_ROADMAP.md Stage 9. */
  effectsIntensity: EffectsIntensity;
  /** How finely detected notes snap to the beat grid — see utils/quantize-grid.ts. Defaults to 'one' (1 beat). */
  quantization: QuantizeGrid;
  /** 0-based order within the parent Idea's Layer stack. */
  position: number;
  createdAt: number;
  updatedAt: number;
}
