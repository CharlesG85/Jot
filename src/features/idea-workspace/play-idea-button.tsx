import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { BUTTON_SIZE as RECORD_BUTTON_SIZE } from '@/features/idea-workspace/record-button';
import { useTheme } from '@/hooks/use-theme';

const BUTTON_SIZE = 56;
const GAP_FROM_RECORD_BUTTON = Spacing.four;
// Positions this button's center left of the (separately, absolutely
// centered) Record button, computed from Record's own size so the two
// never drift apart if either button's dimensions change.
const OFFSET_FROM_CENTER = -(RECORD_BUTTON_SIZE / 2 + GAP_FROM_RECORD_BUTTON + BUTTON_SIZE);

interface PlayIdeaButtonProps {
  isPlaying: boolean;
  disabled?: boolean;
  onPress: () => void;
}

/** Plays every Layer of the Idea together, looping. Sits beside (not replacing) the Record button. */
export function PlayIdeaButton({ isPlaying, disabled, onPress }: PlayIdeaButtonProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      accessibilityLabel={isPlaying ? 'Stop playback' : 'Play Idea'}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        {
          backgroundColor: theme.accent,
          bottom: insets.bottom + Spacing.four,
          marginLeft: OFFSET_FROM_CENTER,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <SymbolView name={isPlaying ? 'stop.fill' : 'play.fill'} tintColor="#ffffff" size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: '50%',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
});
