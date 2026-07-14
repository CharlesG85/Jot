import { Slider } from '@expo/ui';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Sharing from 'expo-sharing';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { EditableLayerName } from '@/features/idea-workspace/editable-layer-name';
import { EffectsIntensitySelector } from '@/features/idea-workspace/effects-intensity-selector';
import { InstrumentSelector } from '@/features/idea-workspace/instrument-selector';
import { useLayerProcessingPhase } from '@/features/idea-workspace/midi-processing-store';
import { useTheme } from '@/hooks/use-theme';
import type { EffectsIntensity, Layer } from '@/models/layer';
import type { InstrumentId } from '@/models/instrument';
import { logAudioLifecycle } from '@/utils/audio-lifecycle-logger';
import { formatBars } from '@/utils/format-bar-count';
import { getLayerPlaybackPath } from '@/utils/layer-playback';
import { logRender } from '@/utils/render-logger';

const DELETE_RED = '#FF3B30';

interface LayerCardProps {
  layer: Layer;
  onRename: (name: string) => void;
  onToggleMute: () => void;
  onToggleSolo: () => void;
  onDelete: () => void;
  onToggleMidi: () => void;
  onChangeInstrument: (instrument: InstrumentId) => void;
  onChangeVolume: (volume: number) => void;
  onChangeEffectsIntensity: (intensity: EffectsIntensity) => void;
}

export function LayerCard({
  layer,
  onRename,
  onToggleMute,
  onToggleSolo,
  onDelete,
  onToggleMidi,
  onChangeInstrument,
  onChangeVolume,
  onChangeEffectsIntensity,
}: LayerCardProps) {
  logRender('LayerCard');
  const theme = useTheme();
  const processingPhase = useLayerProcessingPhase(layer.id);
  const [isExpanded, setIsExpanded] = useState(false);
  // The preview player is created lazily, on first press of the play
  // button (see createPreviewPlayer) — not at mount — so a Layer sitting
  // untouched in the list doesn't hold a native player. The bar-count
  // label doesn't depend on this player at all — it reads `loopLengthBars`
  // straight from the Layer, computed once at record time (Stage 6.5).
  const playerRef = useRef<AudioPlayer | null>(null);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  function releasePlayer() {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    const player = playerRef.current;
    if (!player) {
      return;
    }
    logAudioLifecycle('player', 'destroy', player.id, `layer-preview:${layer.id}`);
    player.remove();
    playerRef.current = null;
  }

  // Only cleanup path needed beyond "playback finished" (handled inline
  // below) — releases the preview player if the card unmounts mid-playback.
  useEffect(() => {
    return () => releasePlayer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function createPreviewPlayer(): AudioPlayer {
    const player = createAudioPlayer(getLayerPlaybackPath(layer) ?? undefined);
    logAudioLifecycle('player', 'create', player.id, `layer-preview:${layer.id}`);
    playerRef.current = player;
    subscriptionRef.current = player.addListener('playbackStatusUpdate', (status) => {
      // Players are created on-demand now, so the first status update(s)
      // can arrive before the file has finished loading — a player that
      // hasn't loaded yet reports duration 0, and `didJustFinish` from
      // that state isn't a real completion, just an artifact of nothing
      // being loaded to play yet. Only release on a completion that
      // actually happened after real audio played.
      const isRealCompletion = status.isLoaded && status.duration > 0 && status.didJustFinish;
      if (isRealCompletion) {
        player.seekTo(0);
        setIsPlaying(false);
        releasePlayer();
      }
    });
    return player;
  }

  function handlePlayPause() {
    if (isPlaying) {
      const activePlayer = playerRef.current;
      if (activePlayer) {
        logAudioLifecycle('player', 'pause', activePlayer.id, `layer-preview:${layer.id}`);
        activePlayer.pause();
      }
      setIsPlaying(false);
      return;
    }

    const player = playerRef.current ?? createPreviewPlayer();
    logAudioLifecycle('player', 'play', player.id, `layer-preview:${layer.id}`);
    player.play();
    setIsPlaying(true);
  }

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

  const isMidiUnavailable = !layer.midiData;
  const midiSwitchDisabled = isMidiUnavailable || processingPhase !== null;
  const processingLabel =
    processingPhase === 'analyzing'
      ? 'Converting to MIDI…'
      : processingPhase === 'rendering'
        ? 'Rendering instrument…'
        : null;

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
          accessibilityLabel={isExpanded ? 'Collapse layer' : 'Expand layer'}
          onPress={() => setIsExpanded((prev) => !prev)}
          style={styles.row}
        >
          <Pressable
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            onPress={handlePlayPause}
            style={[styles.playButton, { backgroundColor: theme.accent }]}
          >
            <SymbolView
              name={isPlaying ? 'pause.fill' : 'play.fill'}
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

          {processingPhase ? (
            <ActivityIndicator size="small" />
          ) : (
            layer.midiEnabled && <SymbolView name="pianokeys" tintColor={theme.accent} size={18} />
          )}

          <ThemedText style={styles.duration} themeColor="textSecondary">
            {formatBars(layer.loopLengthBars)}
          </ThemedText>
        </Pressable>

        {isExpanded && (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.expandedContent}>
            <View style={styles.expandedRow}>
              <ThemedText style={Typography.body}>Use MIDI</ThemedText>
              <Switch
                accessibilityLabel="Use MIDI"
                value={layer.midiEnabled}
                onValueChange={onToggleMidi}
                disabled={midiSwitchDisabled}
                trackColor={{ true: theme.accent }}
              />
            </View>
            {processingLabel && (
              <ThemedText style={styles.processingLabel} themeColor="textSecondary">
                {processingLabel}
              </ThemedText>
            )}

            {layer.midiEnabled && layer.instrument && (
              <View style={styles.expandedSection}>
                <ThemedText style={styles.expandedLabel} themeColor="textSecondary">
                  Instrument
                </ThemedText>
                <InstrumentSelector value={layer.instrument} onChange={onChangeInstrument} />
              </View>
            )}

            <View style={styles.expandedSection}>
              <ThemedText style={styles.expandedLabel} themeColor="textSecondary">
                Volume
              </ThemedText>
              <Slider value={layer.volume} onValueChange={onChangeVolume} min={0} max={1} />
            </View>

            <View style={styles.expandedSection}>
              <ThemedText style={styles.expandedLabel} themeColor="textSecondary">
                Effects
              </ThemedText>
              <EffectsIntensitySelector
                value={layer.effectsIntensity}
                onChange={onChangeEffectsIntensity}
              />
            </View>
          </Animated.View>
        )}
      </ThemedView>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.large,
    padding: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
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
  expandedContent: {
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.3)',
    gap: Spacing.three,
  },
  expandedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  processingLabel: {
    ...Typography.footnote,
    marginTop: -Spacing.two,
  },
  expandedSection: {
    gap: Spacing.two,
  },
  expandedLabel: {
    ...Typography.footnote,
    textTransform: 'uppercase',
  },
});
