import type { Idea } from '@/models/idea';
import type { QuantizeGrid } from '@/models/layer';
import { getBeatsPerBar } from '@/utils/loop-duration';

export const QUANTIZE_GRID_OPTIONS: QuantizeGrid[] = ['half', 'one', 'two', 'bar'];

export const QUANTIZE_GRID_LABELS: Record<QuantizeGrid, string> = {
  half: '1/2 Beat',
  one: '1 Beat',
  two: '2 Beats',
  bar: '1 Bar',
};

/**
 * Converts a `QuantizeGrid` selection into a beats-per-grid-step value for
 * `quantizeNoteTiming` (pitch-to-midi.ts). Every option except `'bar'` is a
 * fixed number of beats — `'bar'` depends on the Idea's own time signature
 * (3 beats/bar in 3/4, 4 in 4/4), so it needs `idea` to resolve.
 */
export function quantizeGridToBeats(grid: QuantizeGrid, idea: Pick<Idea, 'timeSignature'>): number {
  switch (grid) {
    case 'half':
      return 0.5;
    case 'one':
      return 1;
    case 'two':
      return 2;
    case 'bar':
      return getBeatsPerBar(idea);
  }
}
