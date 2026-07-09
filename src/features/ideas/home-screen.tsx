import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { IdeaCard } from '@/features/ideas/idea-card';
import { SearchField } from '@/features/ideas/search-field';
import { useIdeasStore } from '@/features/ideas/store';
import type { Idea } from '@/models/idea';

export function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ideas, isLoaded, loadIdeas, createIdea, renameIdea, deleteIdea } = useIdeasStore();
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadIdeas();
  }, [loadIdeas]);

  const filteredIdeas = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return ideas;
    }
    return ideas.filter((idea) => idea.title.toLowerCase().includes(query));
  }, [ideas, searchQuery]);

  async function handleCreateIdea() {
    setSearchQuery('');
    const idea = await createIdea();
    setEditingIdeaId(idea.id);
  }

  async function handleSubmitTitle(idea: Idea, title: string) {
    setEditingIdeaId(null);
    if (title !== idea.title) {
      await renameIdea(idea.id, title);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={filteredIdeas}
        keyExtractor={(idea) => idea.id}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          filteredIdeas.length === 0 && styles.listContentEmpty,
        ]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
            <ThemedText style={styles.headerTitle}>Ideas</ThemedText>
            {ideas.length > 0 && <SearchField value={searchQuery} onChangeText={setSearchQuery} />}
          </View>
        }
        renderItem={({ item }) => (
          <IdeaCard
            idea={item}
            isEditing={editingIdeaId === item.id}
            onOpen={() => router.push({ pathname: '/idea/[id]', params: { id: item.id } })}
            onStartEdit={() => setEditingIdeaId(item.id)}
            onSubmitTitle={(title) => handleSubmitTitle(item, title)}
            onDelete={() => deleteIdea(item.id)}
          />
        )}
        ListEmptyComponent={
          isLoaded ? (
            <ThemedView style={styles.emptyState}>
              <ThemedText style={styles.emptyTitle}>
                {ideas.length === 0 ? 'No Ideas Yet' : 'No Results'}
              </ThemedText>
              <ThemedText style={styles.emptySubtitle} themeColor="textSecondary">
                {ideas.length === 0
                  ? 'Tap the button below to capture your first musical idea.'
                  : `No ideas match "${searchQuery.trim()}".`}
              </ThemedText>
            </ThemedView>
          ) : null
        }
      />

      <Pressable
        accessibilityLabel="New idea"
        onPress={handleCreateIdea}
        style={[
          styles.fab,
          { backgroundColor: theme.accent, bottom: insets.bottom + Spacing.four },
        ]}
      >
        <SymbolView name="plus" tintColor="#ffffff" size={28} weight="semibold" />
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  header: {
    gap: Spacing.three,
  },
  headerTitle: {
    ...Typography.largeTitle,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.five,
  },
  emptyTitle: {
    ...Typography.title,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    width: 60,
    height: 60,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
});
