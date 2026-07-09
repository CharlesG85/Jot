import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { EditableHeaderTitle } from '@/features/idea-workspace/editable-header-title';
import { LyricsEditor } from '@/features/idea-workspace/lyrics-editor';
import { RecordButton } from '@/features/idea-workspace/record-button';
import { SettingsButton } from '@/features/idea-workspace/settings-button';
import { useIdeasStore } from '@/features/ideas/store';

interface WorkspaceScreenProps {
  ideaId: string;
}

export function WorkspaceScreen({ ideaId }: WorkspaceScreenProps) {
  const { ideas, isLoaded, loadIdeas } = useIdeasStore();
  const idea = ideas.find((candidate) => candidate.id === ideaId);

  useEffect(() => {
    if (!isLoaded) {
      loadIdeas();
    }
  }, [isLoaded, loadIdeas]);

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
          <ThemedView type="backgroundElement" style={styles.layerEmptyState}>
            <ThemedText style={styles.layerEmptyTitle}>No Layers Yet</ThemedText>
            <ThemedText style={styles.layerEmptySubtitle} themeColor="textSecondary">
              Layers you record will appear here.
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </ScrollView>

      <RecordButton />
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
