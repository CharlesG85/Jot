import { useState } from 'react';
import { Pressable, TextInput, type TextStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

interface EditableLayerNameProps {
  name: string;
  onSubmit: (name: string) => void;
  /** Tapping to rename only makes sense once the card is already open — otherwise it competes with tapping the card itself to open it. */
  editable: boolean;
  style?: TextStyle;
}

export function EditableLayerName({ name, onSubmit, editable, style }: EditableLayerNameProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <EditableNameInput
        initialName={name}
        style={style}
        onSubmit={(next) => {
          onSubmit(next);
          setIsEditing(false);
        }}
      />
    );
  }

  if (!editable) {
    return (
      <ThemedText style={style} numberOfLines={1}>
        {name}
      </ThemedText>
    );
  }

  return (
    <Pressable accessibilityLabel="Rename layer" onPress={() => setIsEditing(true)}>
      <ThemedText style={style} numberOfLines={1}>
        {name}
      </ThemedText>
    </Pressable>
  );
}

/** Mounted only while editing, so its local state starts fresh from `initialName` each time. */
function EditableNameInput({
  initialName,
  onSubmit,
  style,
}: {
  initialName: string;
  onSubmit: (name: string) => void;
  style?: TextStyle;
}) {
  const theme = useTheme();
  const [draftName, setDraftName] = useState(initialName);

  function handleSubmit() {
    const trimmed = draftName.trim();
    onSubmit(trimmed.length > 0 ? trimmed : initialName);
  }

  return (
    <TextInput
      autoFocus
      value={draftName}
      onChangeText={setDraftName}
      onSubmitEditing={handleSubmit}
      onBlur={handleSubmit}
      selectTextOnFocus
      returnKeyType="done"
      style={[style, { color: theme.text, padding: 0 }]}
    />
  );
}
