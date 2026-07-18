import { SegmentedControl } from '@/components/segmented-control';
import type { QuantizeGrid } from '@/models/layer';
import { QUANTIZE_GRID_LABELS, QUANTIZE_GRID_OPTIONS } from '@/utils/quantize-grid';

interface QuantizeGridSelectorProps {
  value: QuantizeGrid;
  onChange: (grid: QuantizeGrid) => void;
}

export function QuantizeGridSelector({ value, onChange }: QuantizeGridSelectorProps) {
  return (
    <SegmentedControl
      options={QUANTIZE_GRID_OPTIONS}
      value={value}
      getLabel={(option) => QUANTIZE_GRID_LABELS[option]}
      onChange={onChange}
    />
  );
}
