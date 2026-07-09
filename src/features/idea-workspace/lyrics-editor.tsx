import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { useIdeasStore } from '@/features/ideas/store';
import { useTheme } from '@/hooks/use-theme';
import type { Idea } from '@/models/idea';

const AUTOSAVE_DELAY_MS = 600;

interface LyricsEditorProps {
  idea: Idea;
}

export function LyricsEditor({ idea }: LyricsEditorProps) {
  const theme = useTheme();
  const updateLyrics = useIdeasStore((state) => state.updateLyrics);
  const [lyrics, setLyrics] = useState(idea.lyrics);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  function scheduleSave(text: string) {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      updateLyrics(idea.id, text);
    }, AUTOSAVE_DELAY_MS);
  }

  function handleChangeText(text: string) {
    setLyrics(text);
    scheduleSave(text);
  }

  function flushSave() {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (lyrics !== idea.lyrics) {
      updateLyrics(idea.id, lyrics);
    }
  }

  return (
    <TextInput
      value={lyrics}
      onChangeText={handleChangeText}
      onBlur={flushSave}
      multiline
      placeholder="Lyrics"
      placeholderTextColor={theme.textSecondary}
      textAlignVertical="top"
      style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    ...Typography.body,
    borderRadius: Radius.large,
    padding: Spacing.three,
    minHeight: 160,
  },
});
