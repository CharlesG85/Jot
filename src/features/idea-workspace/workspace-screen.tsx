import { Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { EditableHeaderTitle } from '@/features/idea-workspace/editable-header-title';
import { LyricsEditor } from '@/features/idea-workspace/lyrics-editor';
import { PlayIdeaButton } from '@/features/idea-workspace/play-idea-button';
import {
  BUTTON_SIZE as RECORD_BUTTON_SIZE,
  RecordButton,
} from '@/features/idea-workspace/record-button';
import { ReorderableLayerList } from '@/features/idea-workspace/reorderable-layer-list';
import { SettingsButton } from '@/features/idea-workspace/settings-button';
import { Timeline } from '@/features/idea-workspace/timeline';
import { useIdeaPlayback } from '@/features/idea-workspace/use-idea-playback';
import { useLayerRecorder } from '@/features/idea-workspace/use-layer-recorder';
import { useIdeasStore } from '@/features/ideas/store';
import { useTheme } from '@/hooks/use-theme';
import {
  DEFAULT_LOOP_LENGTH_BARS,
  DEFAULT_METRONOME_ENABLED,
  DEFAULT_TEMPO,
  DEFAULT_TIME_SIGNATURE,
} from '@/models/idea';
import type { Layer } from '@/models/layer';
import { storageService } from '@/services/sqlite-storage-service';
import { getBarDurationSeconds } from '@/utils/loop-duration';
import { logRender } from '@/utils/render-logger';

interface WorkspaceScreenProps {
  ideaId: string;
}

export function WorkspaceScreen({ ideaId }: WorkspaceScreenProps) {
  logRender('WorkspaceScreen');
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { ideas, isLoaded, loadIdeas } = useIdeasStore();
  const idea = ideas.find((candidate) => candidate.id === ideaId);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [isEditingLayers, setIsEditingLayers] = useState(false);
  const [isLyricsExpanded, setIsLyricsExpanded] = useState(true);

  useEffect(() => {
    if (!isLoaded) {
      loadIdeas();
    }
  }, [isLoaded, loadIdeas]);

  useEffect(() => {
    storageService.listLayers(ideaId).then(setLayers);
  }, [ideaId]);

  // Idea may not be loaded yet — fall back to defaults so the recorder still
  // has a sane loop boundary before we know the real one. The Not Found
  // screen below covers the case where it never loads.
  const ideaTiming = idea ?? {
    tempo: DEFAULT_TEMPO,
    timeSignature: DEFAULT_TIME_SIGNATURE,
    loopLengthBars: DEFAULT_LOOP_LENGTH_BARS,
    metronomeEnabled: DEFAULT_METRONOME_ENABLED,
  };
  const barDurationSeconds = getBarDurationSeconds(ideaTiming);

  const recorder = useLayerRecorder(ideaId, ideaTiming, (layer) => {
    setLayers((prev) => [...prev, layer]);
  });
  const playback = useIdeaPlayback(layers, barDurationSeconds, ideaTiming.loopLengthBars);

  async function handleRenameLayer(layerId: string, name: string) {
    const updated = await storageService.updateLayer(layerId, { name });
    setLayers((prev) => prev.map((layer) => (layer.id === layerId ? updated : layer)));
  }

  async function handleToggleMute(layerId: string) {
    const target = layers.find((layer) => layer.id === layerId);
    if (!target) {
      return;
    }
    const updated = await storageService.updateLayer(layerId, { muted: !target.muted });
    setLayers((prev) => prev.map((layer) => (layer.id === layerId ? updated : layer)));
  }

  async function handleToggleSolo(layerId: string) {
    const target = layers.find((layer) => layer.id === layerId);
    if (!target) {
      return;
    }
    const updated = await storageService.updateLayer(layerId, { solo: !target.solo });
    setLayers((prev) => prev.map((layer) => (layer.id === layerId ? updated : layer)));
  }

  async function handleDeleteLayer(layerId: string) {
    const target = layers.find((layer) => layer.id === layerId);
    if (!target) {
      return;
    }
    if (target.audioPath) {
      await storageService.deleteRecording(target.audioPath);
    }
    await storageService.deleteLayer(layerId);
    setLayers((prev) => prev.filter((layer) => layer.id !== layerId));
  }

  async function handleReorderLayers(orderedLayers: Layer[]) {
    setLayers(orderedLayers);
    await storageService.reorderLayers(
      ideaId,
      orderedLayers.map((layer) => layer.id),
    );
  }

  function handleRecordButtonPress() {
    if (recorder.phase === 'idle') {
      recorder.start();
    } else {
      recorder.stop();
    }
  }

  if (!idea) {
    return (
      <ThemedView style={styles.notFound}>
        {isLoaded && <ThemedText style={Typography.body}>Idea not found.</ThemedText>}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => <EditableHeaderTitle idea={idea} />,
          headerRight: () => <SettingsButton ideaId={idea.id} />,
        }}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionLabel} themeColor="textSecondary">
              Lyrics
            </ThemedText>
            <Pressable
              accessibilityLabel={isLyricsExpanded ? 'Collapse lyrics' : 'Expand lyrics'}
              onPress={() => setIsLyricsExpanded((prev) => !prev)}
              hitSlop={8}
            >
              <SymbolView
                name={isLyricsExpanded ? 'chevron.up' : 'chevron.down'}
                tintColor={theme.textSecondary}
                size={16}
              />
            </Pressable>
          </View>
          {isLyricsExpanded && (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.lyricsContent}>
              <LyricsEditor idea={idea} />
            </Animated.View>
          )}
        </View>

        <Animated.View layout={LinearTransition} style={styles.layerSection}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionLabel} themeColor="textSecondary">
              Layers
            </ThemedText>
            {layers.length > 0 && (
              <Pressable
                accessibilityLabel={isEditingLayers ? 'Done editing layers' : 'Edit layers'}
                onPress={() => setIsEditingLayers((prev) => !prev)}
              >
                <ThemedText style={styles.editButton} themeColor="accent">
                  {isEditingLayers ? 'Done' : 'Edit'}
                </ThemedText>
              </Pressable>
            )}
          </View>
          {layers.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.layerEmptyState}>
              <ThemedText style={styles.layerEmptyTitle}>No Layers Yet</ThemedText>
              <ThemedText style={styles.layerEmptySubtitle} themeColor="textSecondary">
                Layers you record will appear here.
              </ThemedText>
            </ThemedView>
          ) : (
            <ReorderableLayerList
              layers={layers}
              isEditing={isEditingLayers}
              onRename={handleRenameLayer}
              onToggleMute={handleToggleMute}
              onToggleSolo={handleToggleSolo}
              onDelete={handleDeleteLayer}
              onReorder={handleReorderLayers}
            />
          )}
        </Animated.View>
      </ScrollView>

      <ThemedView style={[styles.dock, { paddingBottom: insets.bottom + Spacing.three }]}>
        <Timeline
          phase={recorder.phase}
          isPlaying={playback.isPlaying}
          idea={ideaTiming}
          recordingDurationMillis={recorder.durationMillis}
          getIdeaPlaybackProgress={playback.getLoopProgress}
        />
        <View style={styles.dockButtons}>
          <RecordButton
            phase={recorder.phase}
            durationMillis={recorder.durationMillis}
            countInBeat={recorder.countInBeat}
            onPress={handleRecordButtonPress}
            disabled={playback.isPlaying}
          />
          <View style={styles.playButtonAnchor}>
            <PlayIdeaButton
              isPlaying={playback.isPlaying}
              disabled={layers.length === 0 || recorder.phase !== 'idle'}
              onPress={playback.isPlaying ? playback.stop : playback.play}
            />
          </View>
        </View>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  dock: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  // RecordButton is the only child left in normal flow, so centering it is
  // unambiguous — no flex-sibling balance for it to depend on.
  dockButtons: {
    position: 'relative',
    alignItems: 'center',
  },
  // Positioned directly off RecordButton's own known size rather than as a
  // balanced flex sibling, so it can't be thrown off by any flex/gap
  // distribution subtlety — its right edge always lands exactly one gap to
  // the left of RecordButton's left edge, regardless of its own width.
  playButtonAnchor: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: '50%',
    marginRight: RECORD_BUTTON_SIZE / 2 + Spacing.four,
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    ...Typography.footnote,
    textTransform: 'uppercase',
  },
  lyricsContent: {
    marginTop: Spacing.two,
  },
  layerSection: {
    gap: Spacing.two,
  },
  editButton: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  layerEmptyState: {
    borderRadius: Radius.large,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.one,
  },
  layerEmptyTitle: {
    ...Typography.headline,
  },
  layerEmptySubtitle: {
    ...Typography.footnote,
    textAlign: 'center',
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
