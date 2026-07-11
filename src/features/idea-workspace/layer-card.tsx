import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Sharing from 'expo-sharing';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { EditableLayerName } from '@/features/idea-workspace/editable-layer-name';
import { useTheme } from '@/hooks/use-theme';
import type { Layer } from '@/models/layer';
import { formatBarCount } from '@/utils/format-bar-count';

const DELETE_RED = '#FF3B30';

interface LayerCardProps {
  layer: Layer;
  barDurationSeconds: number;
  onRename: (name: string) => void;
  onToggleMute: () => void;
  onToggleSolo: () => void;
  onDelete: () => void;
}

export function LayerCard({
  layer,
  barDurationSeconds,
  onRename,
  onToggleMute,
  onToggleSolo,
  onDelete,
}: LayerCardProps) {
  const theme = useTheme();
  const player = useAudioPlayer(layer.audioPath ?? undefined);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (status.didJustFinish) {
      player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  async function handleExport() {
    if (!layer.audioPath) {
      return;
    }
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert('Sharing Unavailable', 'Sharing is not available on this device.');
      return;
    }
    await Sharing.shareAsync(layer.audioPath, {
      mimeType: 'audio/mp4',
      UTI: 'public.mpeg-4-audio',
      dialogTitle: layer.name,
    });
  }

  return (
    <Swipeable
      renderRightActions={() => (
        <View style={styles.swipeActions}>
          <Pressable
            accessibilityLabel="Export layer"
            onPress={handleExport}
            style={[styles.swipeAction, { backgroundColor: theme.accent }]}
          >
            <SymbolView name="square.and.arrow.up" tintColor="#ffffff" size={20} />
          </Pressable>
          <Pressable
            accessibilityLabel="Delete layer"
            onPress={onDelete}
            style={[styles.swipeAction, { backgroundColor: DELETE_RED }]}
          >
            <SymbolView name="trash" tintColor="#ffffff" size={20} />
          </Pressable>
        </View>
      )}
    >
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

        <View style={styles.nameContainer}>
          <EditableLayerName name={layer.name} onSubmit={onRename} style={styles.name} />
        </View>

        <Pressable
          accessibilityLabel={layer.muted ? 'Unmute layer' : 'Mute layer'}
          onPress={onToggleMute}
          hitSlop={8}
        >
          <SymbolView
            name={layer.muted ? 'speaker.slash.fill' : 'speaker.wave.2.fill'}
            tintColor={layer.muted ? DELETE_RED : theme.textSecondary}
            size={18}
          />
        </Pressable>

        <Pressable
          accessibilityLabel={layer.solo ? 'Unsolo layer' : 'Solo layer'}
          onPress={onToggleSolo}
          hitSlop={8}
        >
          <SymbolView
            name="headphones"
            tintColor={layer.solo ? theme.accent : theme.textSecondary}
            size={18}
          />
        </Pressable>

        <ThemedText style={styles.duration} themeColor="textSecondary">
          {formatBarCount(status.duration, barDurationSeconds)}
        </ThemedText>
      </ThemedView>
    </Swipeable>
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
  nameContainer: {
    flex: 1,
  },
  name: {
    ...Typography.headline,
  },
  duration: {
    ...Typography.footnote,
  },
  swipeActions: {
    flexDirection: 'row',
  },
  swipeAction: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
