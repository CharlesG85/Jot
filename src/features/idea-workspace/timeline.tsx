import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useTransportProgress } from '@/features/idea-workspace/use-transport-progress';
import { useTheme } from '@/hooks/use-theme';
import type { Idea } from '@/models/idea';
import type { RecordingPhase } from '@/services/audio-service';
import { getBarDurationSeconds, getBeatsPerBar } from '@/utils/loop-duration';

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
  phase: RecordingPhase;
  idea: Pick<Idea, 'tempo' | 'timeSignature' | 'loopLengthBars'>;
  /** Real playback position snapshot — see useIdeaPlayback.getLoopProgress. */
  getIdeaPlaybackProgress: () => number | null;
}

/**
 * A thin, informational-only horizontal strip showing the Idea's loop
 * structure — bar and beat tick marks, plus a linear position indicator —
 * during count-in, recording, and playback (docs/03_ROADMAP.md Stage 7
 * additional tasks). Never supports scrubbing, editing, or waveform display;
 * purely a timing reference.
 *
 * The indicator's position comes from useTransportProgress, which runs
 * Recording and Playback as two distinct synchronization models rather than
 * one shared clock — see that hook and docs/07_AUDIO_ARCHITECTURE.md §15-16.
 * The indicator stays parked at 0 during count-in (there's no audio yet to
 * reflect) and whenever otherwise idle.
 */
export function Timeline({ phase, idea, getIdeaPlaybackProgress }: TimelineProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const beatsPerBar = getBeatsPerBar(idea);
  const barDurationSeconds = getBarDurationSeconds(idea);
  const loopDurationSeconds = idea.loopLengthBars * barDurationSeconds;
  const totalBeats = beatsPerBar * idea.loopLengthBars;

  const progress = useTransportProgress({
    phase,
    loopDurationSeconds,
    getIdeaPlaybackProgress,
  });

  const drawableWidth = Math.max(0, width - EDGE_INSET * 2);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: EDGE_INSET + progress.value * drawableWidth }],
  }));

  const playedStyle = useAnimatedStyle(() => ({
    width: EDGE_INSET + progress.value * drawableWidth,
  }));

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
