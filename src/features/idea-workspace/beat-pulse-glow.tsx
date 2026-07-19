import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
import { beatPulseEnvelope } from '@/utils/beat-pulse-envelope';

// Large enough that the visible arc within the dock's width reads as
// nearly flat rather than a visible dome.
const GLOW_DIAMETER = 1800;
// How far the circle's top edge rises above the dock's own bottom edge —
// tuned independently of GLOW_DIAMETER (see the `bottom` calculation
// below). The button row (RecordButton + its beat-digit label) plus the
// gap up to Timeline only guarantees ~130-134px of headroom below
// Timeline's own top edge on a device with no bottom safe-area inset (e.g.
// iPhone SE) — this value exceeds that, so on such a device the glow can
// reach slightly into the Timeline strip. Devices with a home-indicator
// inset have more headroom and stay clear.
const VISIBLE_RISE = 220;
// The scale animation's floor (right after the attack settles) and total
// range. A higher floor means the settle dip is less dramatic — the circle
// never shrinks back much before breathing toward the next beat — while
// the range stays small since GLOW_DIAMETER is large enough that even a
// modest fraction of it is a big absolute pixel swing.
const SCALE_FLOOR = 1.03;
const SCALE_RANGE = 0.02;

interface BeatPulseGlowProps {
  /** See RecordingTransportResult.currentBeat. */
  currentBeat: SharedValue<number>;
  /** See RecordingTransportResult.beatPhase. */
  beatPhase: SharedValue<number>;
  beatsPerBar: number;
}

/**
 * The ambient, peripheral-vision layer of the visual metronome —
 * docs/07_AUDIO_ARCHITECTURE.md §15's Metronome subsystem, now visual
 * rather than haptic (iOS silences UIFeedbackGenerator/Core Haptics during
 * active recording, to keep the Taptic Engine's vibration out of the mic —
 * see docs/05_BACKLOG.md's "Haptic Feedback During Recording" entry).
 *
 * A large, very soft glow anchored behind the dock — not the Record button —
 * so it stays visible regardless of where the user's thumb is. Deliberately
 * subtle: opacity only ever swings a few percent, since this is meant to be
 * felt in peripheral vision while looking at lyrics or an instrument, not
 * stared at. RecordButton's beat digit is the precise, foveal counterpart —
 * this is the one you don't have to look at to feel.
 *
 * A plain shadowed circle, not a gradient library — this app has no
 * react-native-svg/expo-linear-gradient dependency, and a soft iOS shadow
 * gives the same diffuse falloff without adding one.
 *
 * Purely reactive: every frame re-derives intensity fresh from beatPhase
 * (see beat-pulse-envelope.ts) rather than running its own animation clock,
 * so it can never drift from the Transport that computed beatPhase.
 */
export function BeatPulseGlow({ currentBeat, beatPhase, beatsPerBar }: BeatPulseGlowProps) {
  const theme = useTheme();

  const glowStyle = useAnimatedStyle(() => {
    if (currentBeat.value < 0) {
      return { opacity: 0, transform: [{ scale: 1 }] };
    }
    const isAccent = currentBeat.value % beatsPerBar === 0;
    const intensity = beatPulseEnvelope(beatPhase.value, isAccent);
    return {
      opacity: intensity * 0.4,
      transform: [{ scale: SCALE_FLOOR + intensity * SCALE_RANGE }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.glow,
        glowStyle,
        {
          backgroundColor: theme.accent,
          shadowColor: theme.accent,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: -(GLOW_DIAMETER - VISIBLE_RISE),
    width: GLOW_DIAMETER,
    height: GLOW_DIAMETER,
    borderRadius: GLOW_DIAMETER / 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 120,
  },
});
