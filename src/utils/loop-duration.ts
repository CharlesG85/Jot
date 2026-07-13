import type { Idea } from '@/models/idea';

const BEATS_PER_BAR: Record<Idea['timeSignature'], number> = {
  '4/4': 4,
  '3/4': 3,
};

/** The number of beats per bar for the Idea's time signature. */
export function getBeatsPerBar(idea: Pick<Idea, 'timeSignature'>): number {
  return BEATS_PER_BAR[idea.timeSignature];
}

/** The length of a single bar in seconds, derived from tempo and time signature. */
export function getBarDurationSeconds(idea: Pick<Idea, 'tempo' | 'timeSignature'>): number {
  const secondsPerBeat = 60 / idea.tempo;
  return getBeatsPerBar(idea) * secondsPerBeat;
}

/** The Idea's loop length in seconds, derived from tempo, time signature, and bar count. */
export function getLoopDurationSeconds(
  idea: Pick<Idea, 'tempo' | 'timeSignature' | 'loopLengthBars'>,
): number {
  return idea.loopLengthBars * getBarDurationSeconds(idea);
}

/** The only bar lengths a Layer's playback loop can round to (docs/03_ROADMAP.md Stage 6.5). */
export const ALLOWED_LAYER_LOOP_LENGTHS_BARS = [1, 2, 4, 8] as const;

/**
 * Picks the playback loop length for a newly-recorded Layer: the smallest
 * allowed bar count that's at least as long as what was actually recorded,
 * so a loop repeat never cuts off performed audio. Recordings longer than
 * the largest allowed length (8 bars) are capped there — the saved file
 * still contains everything performed, only looped Idea playback restarts
 * early.
 */
export function computeLoopLengthBars(durationSeconds: number, barDurationSeconds: number): number {
  const bars = durationSeconds / barDurationSeconds;
  const fit = ALLOWED_LAYER_LOOP_LENGTHS_BARS.find((allowed) => bars <= allowed);
  return fit ?? ALLOWED_LAYER_LOOP_LENGTHS_BARS[ALLOWED_LAYER_LOOP_LENGTHS_BARS.length - 1];
}
