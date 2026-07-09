import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const BUTTON_SIZE = 76;

/** Starts recording into the currently selected Layer once Stage 4 builds the recording engine. */
export function RecordButton() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      accessibilityLabel="Record (coming soon)"
      disabled
      style={[
        styles.button,
        { backgroundColor: theme.accent, bottom: insets.bottom + Spacing.four },
      ]}
    >
      <SymbolView name="mic.fill" tintColor="#ffffff" size={30} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: '50%',
    marginLeft: -BUTTON_SIZE / 2,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
});
