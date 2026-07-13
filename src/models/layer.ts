/**
 * A Layer is a single musical performance within an Idea (melody, harmony,
 * bass line, etc). Layers inherit tempo/time signature/loop length from
 * their parent Idea and never have independent timing.
 */

export interface Layer {
  id: string;
  ideaId: string;
  name: string;
  instrument: string | null;
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
  /** Reserved for the future MIDI pipeline (docs/03_ROADMAP.md Stage 8). */
  midiData: string | null;
  /** 0-based order within the parent Idea's Layer stack. */
  position: number;
  createdAt: number;
  updatedAt: number;
}
