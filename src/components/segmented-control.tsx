import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface SegmentedControlProps<T extends string | number> {
  options: T[];
  value: T;
  getLabel: (option: T) => string;
  onChange: (option: T) => void;
}

/** A pill-style mutually-exclusive selector — extracted from settings-sheet.tsx so it can be reused (e.g. Layer instrument/effects-intensity selectors) without duplicating the same UI. */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  getLabel,
  onChange,
}: SegmentedControlProps<T>) {
  const theme = useTheme();

  return (
    <View style={[styles.segmentedControl, { backgroundColor: theme.backgroundElement }]}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={String(option)}
            accessibilityLabel={getLabel(option)}
            onPress={() => onChange(option)}
            style={[styles.segment, selected && { backgroundColor: theme.accent }]}
          >
            <ThemedText style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>
              {getLabel(option)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: Radius.medium,
    padding: Spacing.half,
    gap: Spacing.half,
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
    alignItems: 'center',
  },
  segmentLabel: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  segmentLabelSelected: {
    color: '#ffffff',
  },
});
