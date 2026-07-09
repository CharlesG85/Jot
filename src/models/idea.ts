/**
 * An Idea is the top-level object in the app: a single musical concept
 * containing lyrics and one or more recorded Layers. See docs/00_PROJECT_VISION.md.
 */

export type TimeSignature = '4/4' | '3/4';

export const DEFAULT_TEMPO = 60;
export const DEFAULT_TIME_SIGNATURE: TimeSignature = '4/4';
export const DEFAULT_LOOP_LENGTH_BARS = 4;

export interface Idea {
  id: string;
  title: string;
  lyrics: string;
  tempo: number;
  timeSignature: TimeSignature;
  loopLengthBars: number;
  createdAt: number;
  /** Last substantive content edit (lyrics, timing, Layers) — used to sort the Idea list. Renaming alone does not bump this. */
  updatedAt: number;
}
