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
