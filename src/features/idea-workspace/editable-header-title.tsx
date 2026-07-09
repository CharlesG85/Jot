import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Typography } from '@/constants/theme';
import { useIdeasStore } from '@/features/ideas/store';
import { useTheme } from '@/hooks/use-theme';
import type { Idea } from '@/models/idea';

interface EditableHeaderTitleProps {
  idea: Idea;
}

export function EditableHeaderTitle({ idea }: EditableHeaderTitleProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return <EditableTitleInput idea={idea} onDone={() => setIsEditing(false)} />;
  }

  return (
    <Pressable accessibilityLabel="Rename idea" onPress={() => setIsEditing(true)}>
      <ThemedText style={styles.title} numberOfLines={1}>
        {idea.title}
      </ThemedText>
    </Pressable>
  );
}

/** Mounted only while editing, so its local state starts fresh from `idea.title` each time. */
function EditableTitleInput({ idea, onDone }: { idea: Idea; onDone: () => void }) {
  const theme = useTheme();
  const renameIdea = useIdeasStore((state) => state.renameIdea);
  const [draftTitle, setDraftTitle] = useState(idea.title);

  function handleSubmit() {
    const trimmed = draftTitle.trim();
    renameIdea(idea.id, trimmed.length > 0 ? trimmed : 'New Idea');
    onDone();
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
      style={[styles.title, styles.input, { color: theme.text }]}
    />
  );
}

const styles = StyleSheet.create({
  title: {
    ...Typography.headline,
  },
  input: {
    minWidth: 120,
    padding: 0,
  },
});
