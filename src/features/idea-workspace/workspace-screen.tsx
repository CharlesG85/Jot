import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { EditableHeaderTitle } from '@/features/idea-workspace/editable-header-title';
import { LayerCard } from '@/features/idea-workspace/layer-card';
import { LyricsEditor } from '@/features/idea-workspace/lyrics-editor';
import { RecordButton } from '@/features/idea-workspace/record-button';
import { SettingsButton } from '@/features/idea-workspace/settings-button';
import { useLayerRecorder } from '@/features/idea-workspace/use-layer-recorder';
import { useIdeasStore } from '@/features/ideas/store';
import type { Layer } from '@/models/layer';
import { storageService } from '@/services/sqlite-storage-service';

interface WorkspaceScreenProps {
  ideaId: string;
}

export function WorkspaceScreen({ ideaId }: WorkspaceScreenProps) {
  const { ideas, isLoaded, loadIdeas } = useIdeasStore();
  const idea = ideas.find((candidate) => candidate.id === ideaId);
  const [layers, setLayers] = useState<Layer[]>([]);

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
        <LyricsEditor idea={idea} />

        <ThemedView style={styles.layerSection}>
          <ThemedText style={styles.sectionLabel} themeColor="textSecondary">
            Layers
          </ThemedText>
          {layers.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.layerEmptyState}>
              <ThemedText style={styles.layerEmptyTitle}>No Layers Yet</ThemedText>
              <ThemedText style={styles.layerEmptySubtitle} themeColor="textSecondary">
                Layers you record will appear here.
              </ThemedText>
            </ThemedView>
          ) : (
            layers.map((layer) => <LayerCard key={layer.id} layer={layer} />)
          )}
        </ThemedView>
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
    paddingBottom: Spacing.six + Spacing.four,
  },
  layerSection: {
    gap: Spacing.two,
  },
  sectionLabel: {
    ...Typography.footnote,
    textTransform: 'uppercase',
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
