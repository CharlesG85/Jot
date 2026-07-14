import { SegmentedControl } from '@/components/segmented-control';
import type { EffectsIntensity } from '@/models/layer';

const OPTIONS: EffectsIntensity[] = ['off', 'low', 'medium', 'high'];
const LABELS: Record<EffectsIntensity, string> = {
  off: 'Off',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

interface EffectsIntensitySelectorProps {
  value: EffectsIntensity;
  onChange: (intensity: EffectsIntensity) => void;
}

/** UI + persisted setting only — does not yet affect rendered audio. See docs/03_ROADMAP.md Stage 9. */
export function EffectsIntensitySelector({ value, onChange }: EffectsIntensitySelectorProps) {
  return (
    <SegmentedControl
      options={OPTIONS}
      value={value}
      getLabel={(option) => LABELS[option]}
      onChange={onChange}
    />
  );
}
