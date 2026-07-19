import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { RecordingPhase } from '@/services/audio-service';
import { beatPulseEnvelope } from '@/utils/beat-pulse-envelope';
import { logRender } from '@/utils/render-logger';

export const BUTTON_SIZE = 76;
const RECORD_RED = '#FF3B30';

interface RecordButtonProps {
  phase: RecordingPhase;
  /** 1-4 while phase is 'counting-in', otherwise null. */
  countInBeat: number | null;
  /** See RecordingTransportResult.currentBeat. */
  currentBeat: SharedValue<number>;
  /** See RecordingTransportResult.beatPhase. */
  beatPhase: SharedValue<number>;
  beatsPerBar: number;
  onPress: () => void;
  /** Disables the button for reasons outside its own state — e.g. Idea playback is active. */
  disabled?: boolean;
}

export function RecordButton({
  phase,
  countInBeat,
  currentBeat,
  beatPhase,
  beatsPerBar,
  onPress,
  disabled,
}: RecordButtonProps) {
  logRender('RecordButton');
  const theme = useTheme();
  const pulse = useSharedValue(1);
  const [beatInBar, setBeatInBar] = useState<number | null>(null);

  // currentBeat only needs to reach JS at all to render the digit — the
  // actual animation below reads it directly on the UI thread, so this
  // doesn't gate any motion, only the text content.
  useAnimatedReaction(
    () => currentBeat.value,
    (beat) => {
      runOnJS(setBeatInBar)(beat < 0 ? null : (beat % beatsPerBar) + 1);
    },
    [beatsPerBar],
  );

  useEffect(() => {
    if (phase !== 'recording' && phase !== 'counting-in') {
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [phase, pulse]);

  // Counting-in has its own beat-synced feedback: a quick "bump" each time
  // the beat number changes, instead of the continuous recording pulse.
  // Reanimated SharedValues are mutable-by-design UI-thread containers, not
  // real React state — mutating `pulse.value` from a second effect that also
  // lists it as a dependency isn't the cross-effect state mutation this rule
  // means to catch.
  /* eslint-disable react-hooks/immutability */
  useEffect(() => {
    if (phase === 'counting-in' && countInBeat !== null) {
      pulse.value = withSequence(
        withTiming(1.25, { duration: 80 }),
        withTiming(1, { duration: 150 }),
      );
    }
  }, [phase, countInBeat, pulse]);
  /* eslint-enable react-hooks/immutability */

  // The visual metronome (docs/07_AUDIO_ARCHITECTURE.md §15-16's Metronome
  // subsystem — visual rather than haptic, see beat-pulse-envelope.ts for
  // why): while recording, the button's own scale follows the same
  // pulse+breathe envelope as BeatPulseGlow and Timeline's active tick,
  // computed fresh every frame from beatPhase rather than a retriggered
  // animation — replaces the old constant withRepeat pulse, which had no
  // relationship to the actual beat.
  const pulseStyle = useAnimatedStyle(() => {
    if (phase !== 'recording' || currentBeat.value < 0) {
      return { transform: [{ scale: pulse.value }] };
    }
    const isAccent = currentBeat.value % beatsPerBar === 0;
    const intensity = beatPulseEnvelope(beatPhase.value, isAccent);
    return { transform: [{ scale: 1 + intensity * (isAccent ? 0.18 : 0.1) }] };
  });

  // The beat digit itself pulses more emphatically than the button — it's
  // the precise, foveal layer of the metronome (see BeatPulseGlow for the
  // ambient, peripheral one), so it's allowed to be the most legible motion.
  const digitStyle = useAnimatedStyle(() => {
    if (phase !== 'recording' || currentBeat.value < 0) {
      return { transform: [{ scale: 1 }] };
    }
    const isAccent = currentBeat.value % beatsPerBar === 0;
    const intensity = beatPulseEnvelope(beatPhase.value, isAccent);
    return { transform: [{ scale: 1 + intensity * (isAccent ? 0.5 : 0.3) }] };
  });

  const backgroundColor = phase === 'recording' ? RECORD_RED : theme.accent;
  const label =
    phase === 'recording'
      ? 'Stop recording'
      : phase === 'processing'
        ? 'Saving recording'
        : phase === 'counting-in'
          ? 'Cancel count-in'
          : 'Record';

  return (
    <View style={styles.container}>
      {phase === 'recording' && beatInBar !== null && (
        <Animated.View style={digitStyle}>
          <ThemedText style={styles.timer}>{beatInBar}</ThemedText>
        </Animated.View>
      )}
      {phase === 'counting-in' && countInBeat !== null && (
        <ThemedText style={styles.timer}>{countInBeat}</ThemedText>
      )}
      <Animated.View style={pulseStyle}>
        <Pressable
          accessibilityLabel={label}
          onPress={onPress}
          disabled={phase === 'processing' || disabled}
          style={[styles.button, { backgroundColor, opacity: disabled ? 0.4 : 1 }]}
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
