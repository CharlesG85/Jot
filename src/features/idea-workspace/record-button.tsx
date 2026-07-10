import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { RecordingPhase } from '@/services/audio-service';
import { formatDuration } from '@/utils/format-duration';

const BUTTON_SIZE = 76;
const RECORD_RED = '#FF3B30';

/** Space the timer label + gap take up above the button while recording. */
const TIMER_ALLOWANCE = Typography.footnote.lineHeight + Spacing.two;

/**
 * How much clearance scrollable content needs above the safe-area bottom
 * inset to avoid sitting underneath this button (idle or recording state,
 * plus a little breathing room) — see workspace-screen.tsx.
 */
export const RECORD_BUTTON_RESERVED_HEIGHT =
  BUTTON_SIZE + Spacing.four + TIMER_ALLOWANCE + Spacing.three;

interface RecordButtonProps {
  phase: RecordingPhase;
  durationMillis: number;
  onPress: () => void;
}

export function RecordButton({ phase, durationMillis, onPress }: RecordButtonProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (phase === 'recording') {
      pulse.value = withRepeat(
        withTiming(1.15, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [phase, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const backgroundColor = phase === 'recording' ? RECORD_RED : theme.accent;
  const label =
    phase === 'recording'
      ? 'Stop recording'
      : phase === 'processing'
        ? 'Saving recording'
        : 'Record';

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { bottom: insets.bottom + Spacing.four }]}
    >
      {phase === 'recording' && (
        <ThemedText style={styles.timer}>{formatDuration(durationMillis)}</ThemedText>
      )}
      <Animated.View style={pulseStyle}>
        <Pressable
          accessibilityLabel={label}
          onPress={onPress}
          disabled={phase === 'processing'}
          style={[styles.button, { backgroundColor }]}
        >
          {phase === 'processing' ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <SymbolView
              name={phase === 'recording' ? 'square.fill' : 'mic.fill'}
              tintColor="#ffffff"
              size={phase === 'recording' ? 26 : 30}
            />
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: Spacing.two,
  },
  timer: {
    ...Typography.footnote,
    fontVariant: ['tabular-nums'],
  },
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
