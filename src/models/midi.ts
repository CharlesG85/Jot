/**
 * The internal MIDI representation produced by Stage 8's pitch-detection
 * pipeline (docs/03_ROADMAP.md) — a derived, editable analysis of a Layer's
 * recording, never a replacement for it. Times are stored in beats, not
 * seconds, so they stay meaningful independent of tempo, consistent with
 * how the rest of the app already thinks about timing (loopLengthBars, the
 * Timeline).
 *
 * This is intermediate data only: Stage 9 renders it into an audio file
 * offline (per instrument/render settings) rather than ever scheduling or
 * synthesizing it during playback — see docs/07_AUDIO_ARCHITECTURE.md §10.
 */

export interface MidiNote {
  /** MIDI note number, 0-127 (60 = middle C). */
  pitch: number;
  /** Position within the recording, in beats from the start. */
  startBeat: number;
  durationBeats: number;
  /** 0-127, derived from the note's relative loudness within the recording. */
  velocity: number;
}

export interface MidiData {
  notes: MidiNote[];
}

/**
 * A detected note *before* quantization — real-time timing (seconds from
 * the recording's start), not yet snapped to any beat grid. Produced by
 * detectNotesFromPcm (pitch-to-midi.ts) and persisted as `Layer.rawMidiData`
 * so quantization can be redone cheaply (no pitch re-detection) whenever a
 * Layer's `quantization` setting changes.
 */
export interface RawMidiNote {
  pitch: number;
  startSeconds: number;
  durationSeconds: number;
  velocity: number;
}

export interface RawMidiData {
  notes: RawMidiNote[];
}
