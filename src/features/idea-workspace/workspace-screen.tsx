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
import {
  RECORD_BUTTON_RESERVED_HEIGHT,
  RecordButton,
} from '@/features/idea-workspace/record-button';
import { ReorderableLayerList } from '@/features/idea-workspace/reorderable-layer-list';
import { SettingsButton } from '@/features/idea-workspace/settings-button';
import { useLayerRecorder } from '@/features/idea-workspace/use-layer-recorder';
import { useIdeasStore } from '@/features/ideas/store';
import { useTheme } from '@/hooks/use-theme';
import type { Layer } from '@/models/layer';
import { storageService } from '@/services/sqlite-storage-service';

interface WorkspaceScreenProps {
  ideaId: string;
}

export function WorkspaceScreen({ ideaId }: WorkspaceScreenProps) {
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

  const recorder = useLayerRecorder(ideaId, (layer) => {
    setLayers((prev) => [...prev, layer]);
  });

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
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + RECORD_BUTTON_RESERVED_HEIGHT },
        ]}
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

      <RecordButton
        phase={recorder.phase}
        durationMillis={recorder.durationMillis}
        onPress={recorder.phase === 'recording' ? recorder.stop : recorder.start}
      />
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
