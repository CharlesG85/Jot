import { SegmentedControl } from '@/components/segmented-control';
import { ALL_INSTRUMENTS, INSTRUMENT_NAMES, type InstrumentId } from '@/models/instrument';

interface InstrumentSelectorProps {
  value: InstrumentId;
  onChange: (instrument: InstrumentId) => void;
}

/**
 * Hidden while there's only one instrument to choose from (today: just
 * Synth) — a selector offering no real choice would be closer to
 * placeholder UI than a real control. Starts rendering automatically once
 * more instruments are added to src/models/instrument.ts.
 */
export function InstrumentSelector({ value, onChange }: InstrumentSelectorProps) {
  if (ALL_INSTRUMENTS.length <= 1) {
    return null;
  }

  return (
    <SegmentedControl
      options={ALL_INSTRUMENTS}
      value={value}
      getLabel={(option) => INSTRUMENT_NAMES[option]}
      onChange={onChange}
    />
  );
}
