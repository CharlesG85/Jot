import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Idea } from '@/models/idea';
import { formatRelativeDate } from '@/utils/format-date';

interface IdeaCardProps {
  idea: Idea;
  isEditing: boolean;
  onOpen: () => void;
  onStartEdit: () => void;
  onSubmitTitle: (title: string) => void;
  onDelete: () => void;
}

export function IdeaCard({
  idea,
  isEditing,
  onOpen,
  onStartEdit,
  onSubmitTitle,
  onDelete,
}: IdeaCardProps) {
  return (
    <Swipeable
      renderRightActions={() => (
        <Pressable accessibilityLabel="Delete idea" onPress={onDelete} style={styles.deleteAction}>
          <SymbolView name="trash" tintColor="#ffffff" size={22} />
        </Pressable>
      )}
    >
      <Pressable onPress={onOpen}>
        <ThemedView type="backgroundElement" style={styles.card}>
          {isEditing ? (
            <EditableTitleInput initialTitle={idea.title} onSubmit={onSubmitTitle} />
          ) : (
            <Pressable accessibilityLabel="Rename idea" onPress={onStartEdit} hitSlop={8}>
              <ThemedText style={styles.title} numberOfLines={1}>
                {idea.title}
              </ThemedText>
            </Pressable>
          )}
          <ThemedText style={styles.date} themeColor="textSecondary">
            {formatRelativeDate(idea.updatedAt)}
          </ThemedText>
        </ThemedView>
      </Pressable>
    </Swipeable>
  );
}

/** Mounted only while editing, so its local state starts fresh from `initialTitle` each time. */
function EditableTitleInput({
  initialTitle,
  onSubmit,
}: {
  initialTitle: string;
  onSubmit: (title: string) => void;
}) {
  const theme = useTheme();
  const [draftTitle, setDraftTitle] = useState(initialTitle);

  function handleSubmit() {
    const trimmed = draftTitle.trim();
    onSubmit(trimmed.length > 0 ? trimmed : 'New Idea');
  }

  return (
    <TextInput
      autoFocus
      value={draftTitle}
      onChangeText={setDraftTitle}
      onSubmitEditing={handleSubmit}
      onBlur={handleSubmit}
      selectTextOnFocus
      returnKeyType="done"
      style={[styles.title, { color: theme.text }]}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.large,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.half,
  },
  title: {
    ...Typography.headline,
    padding: 0,
  },
  date: {
    ...Typography.footnote,
  },
  deleteAction: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 76,
    borderRadius: Radius.large,
  },
});
