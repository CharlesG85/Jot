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
  /** Reserved for the future MIDI pipeline (docs/03_ROADMAP.md Stage 8). */
  midiData: string | null;
  /** 0-based order within the parent Idea's Layer stack. */
  position: number;
  createdAt: number;
  updatedAt: number;
}
