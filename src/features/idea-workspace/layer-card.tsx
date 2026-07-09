import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/utils/format-duration';
import type { Layer } from '@/models/layer';

interface LayerCardProps {
  layer: Layer;
}

/** Minimal Layer card for Stage 4: name, play/pause, duration. Swipe/mute/solo/rename arrive in Stage 5. */
export function LayerCard({ layer }: LayerCardProps) {
  const theme = useTheme();
  const player = useAudioPlayer(layer.audioPath ?? undefined);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (status.didJustFinish) {
      player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <Pressable
        accessibilityLabel={status.playing ? 'Pause' : 'Play'}
        onPress={() => (status.playing ? player.pause() : player.play())}
        style={[styles.playButton, { backgroundColor: theme.accent }]}
      >
        <SymbolView
          name={status.playing ? 'pause.fill' : 'play.fill'}
          tintColor="#ffffff"
          size={16}
        />
      </Pressable>

      <ThemedText style={styles.name} numberOfLines={1}>
        {layer.name}
      </ThemedText>

      <ThemedText style={styles.duration} themeColor="textSecondary">
        {formatDuration(status.duration * 1000)}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    ...Typography.headline,
    flex: 1,
  },
  duration: {
    ...Typography.footnote,
  },
});
