import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const BUTTON_SIZE = 56;

interface PlayIdeaButtonProps {
  isPlaying: boolean;
  disabled?: boolean;
  onPress: () => void;
}

/** Plays every Layer of the Idea together, looping. Sits beside (not replacing) the Record button. */
export function PlayIdeaButton({ isPlaying, disabled, onPress }: PlayIdeaButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityLabel={isPlaying ? 'Stop playback' : 'Play Idea'}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        {
          backgroundColor: theme.accent,
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
