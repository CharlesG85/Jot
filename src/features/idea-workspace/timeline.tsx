import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
import type { Idea } from '@/models/idea';
import { beatPulseEnvelope } from '@/utils/beat-pulse-envelope';
import { getBeatsPerBar } from '@/utils/loop-duration';

const STRIP_HEIGHT = 28;
const BAR_TICK_WIDTH = 2;
const BEAT_TICK_WIDTH = 1;
const INDICATOR_WIDTH = 2;
// The first and last ticks are always bar starts (the widest mark) and are
// centered on their exact beat position — without this inset, half of each
// would fall outside the container and get clipped by its overflow:hidden,
// making them look thinner than every other tick.
const EDGE_INSET = BAR_TICK_WIDTH / 2;

interface TimelineProps {
  idea: Pick<Idea, 'tempo' | 'timeSignature' | 'loopLengthBars'>;
  /** See TransportProgressResult — one Transport instance, owned by WorkspaceScreen and shared with RecordButton/BeatPulseGlow, so all three can never disagree about where "now" is. */
  progress: SharedValue<number>;
  recordingBeat: SharedValue<number>;
  recordingBeatPhase: SharedValue<number>;
}

/**
 * A thin, informational-only horizontal strip showing the Idea's loop
 * structure — bar and beat tick marks, plus a linear position indicator —
 * during count-in, recording, and playback (docs/03_ROADMAP.md Stage 7
 * additional tasks). Never supports scrubbing, editing, or waveform display;
 * purely a timing reference.
 *
 * The indicator's position comes from `progress`, computed by
 * useTransportProgress up in WorkspaceScreen (not here — RecordButton and
 * BeatPulseGlow need the same Transport instance, so it's owned one level
 * up and passed down rather than each mounting its own — see that hook and
 * docs/07_AUDIO_ARCHITECTURE.md §15-16). The indicator stays parked at 0
 * during count-in (there's no audio yet to reflect) and whenever otherwise
 * idle.
 *
 * The active beat's own tick mark also pulses with the same envelope as
 * RecordButton's digit and BeatPulseGlow (beat-pulse-envelope.ts) — the
 * cheapest of the three layers, since it's just another consumer of the
 * same signal, and it ties the new visual metronome back into the timeline
 * that's already the authoritative visual reference.
 */
export function Timeline({ idea, progress, recordingBeat, recordingBeatPhase }: TimelineProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const beatsPerBar = getBeatsPerBar(idea);
  const totalBeats = beatsPerBar * idea.loopLengthBars;

  const drawableWidth = Math.max(0, width - EDGE_INSET * 2);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: EDGE_INSET + progress.value * drawableWidth }],
  }));

  const playedStyle = useAnimatedStyle(() => ({
    width: EDGE_INSET + progress.value * drawableWidth,
  }));

  // A single overlay tracking whichever tick is currently active, rather
  // than one useAnimatedStyle per tick — hook count must stay identical
  // across renders, but totalBeats (and so the number of ticks) changes
  // whenever the Idea's loop length does.
  const activeTickStyle = useAnimatedStyle(() => {
    if (totalBeats <= 0 || recordingBeat.value < 0) {
      return { opacity: 0 };
    }
    const tickIndex = recordingBeat.value % totalBeats;
    const isAccent = tickIndex % beatsPerBar === 0;
    const baseWidth = isAccent ? BAR_TICK_WIDTH : BEAT_TICK_WIDTH;
    const intensity = beatPulseEnvelope(recordingBeatPhase.value, isAccent);
    // Very slight — centered on the tick's own position so it grows evenly
    // outward rather than drifting to one side as it widens.
    const width = baseWidth + intensity * 1;
    const center = EDGE_INSET + (tickIndex / totalBeats) * drawableWidth;
    return {
      opacity: intensity,
      left: center - width / 2,
      width,
      transform: [{ scaleY: 1 + intensity * 0.9 }],
    };
  });

  function handleLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {width > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.played, playedStyle, { backgroundColor: theme.accent }]}
        />
      )}
      {width > 0 &&
        Array.from({ length: totalBeats + 1 }, (_, tick) => {
          const isBarStart = tick % beatsPerBar === 0;
          const tickWidth = isBarStart ? BAR_TICK_WIDTH : BEAT_TICK_WIDTH;
          const left = EDGE_INSET + (tick / totalBeats) * drawableWidth - tickWidth / 2;
          return (
            <View
              key={tick}
              style={[
                styles.tick,
                {
                  left,
                  width: tickWidth,
                  opacity: isBarStart ? 1 : 0.5,
                  backgroundColor: isBarStart ? theme.text : theme.textSecondary,
                },
              ]}
            />
          );
        })}
      {width > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.tick, activeTickStyle, { backgroundColor: theme.accent }]}
        />
      )}
      {width > 0 && (
        <Animated.View
          style={[styles.indicator, indicatorStyle, { backgroundColor: theme.accent }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: STRIP_HEIGHT,
    overflow: 'hidden',
  },
  played: {
    position: 'absolute',
    left: 0,
    top: STRIP_HEIGHT * 0.4,
    bottom: 0,
    opacity: 0.2,
  },
  tick: {
    position: 'absolute',
    top: STRIP_HEIGHT * 0.4,
    bottom: 0,
  },
  indicator: {
    position: 'absolute',
    top: STRIP_HEIGHT * 0.4,
    bottom: 0,
    width: INDICATOR_WIDTH,
    borderRadius: INDICATOR_WIDTH / 2,
  },
});
