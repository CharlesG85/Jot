import { Stack, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useIdeasStore } from '@/features/ideas/store';
import { useTheme } from '@/hooks/use-theme';
import type { TimeSignature } from '@/models/idea';

const MIN_TEMPO = 40;
const MAX_TEMPO = 240;
const TIME_SIGNATURES: TimeSignature[] = ['4/4', '3/4'];
const LOOP_LENGTH_OPTIONS = [1, 2, 4, 8];

interface SettingsSheetProps {
  ideaId: string;
}

export function SettingsSheet({ ideaId }: SettingsSheetProps) {
  const router = useRouter();
  const theme = useTheme();
  const { ideas, updateSettings } = useIdeasStore();
  const idea = ideas.find((candidate) => candidate.id === ideaId);

  if (!idea) {
    return <ThemedView style={styles.container} />;
  }

  function adjustTempo(delta: number) {
    const next = Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, idea!.tempo + delta));
    if (next !== idea!.tempo) {
      updateSettings(ideaId, { tempo: next });
    }
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Idea Settings',
          headerLeft: () => null,
          headerRight: () => (
            <Pressable accessibilityLabel="Done" onPress={() => router.back()}>
              <ThemedText style={styles.doneLabel} themeColor="accent">
                Done
              </ThemedText>
            </Pressable>
          ),
        }}
      />

      <View style={styles.section}>
        <ThemedText style={styles.sectionLabel} themeColor="textSecondary">
          Tempo
        </ThemedText>
        <View style={styles.tempoRow}>
          <StepperButton
            icon="minus"
            label="Decrease tempo"
            onPress={() => adjustTempo(-1)}
            disabled={idea.tempo <= MIN_TEMPO}
          />
          <View style={styles.tempoValue}>
            <EditableTempoValue
              tempo={idea.tempo}
              onSubmit={(tempo) => updateSettings(ideaId, { tempo })}
            />
            <ThemedText style={styles.tempoUnit} themeColor="textSecondary">
              BPM
            </ThemedText>
          </View>
          <StepperButton
            icon="plus"
            label="Increase tempo"
            onPress={() => adjustTempo(1)}
            disabled={idea.tempo >= MAX_TEMPO}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionLabel} themeColor="textSecondary">
          Time Signature
        </ThemedText>
        <SegmentedControl
          options={TIME_SIGNATURES}
          value={idea.timeSignature}
          getLabel={(option) => option}
          onChange={(timeSignature) => updateSettings(ideaId, { timeSignature })}
        />
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionLabel} themeColor="textSecondary">
          Loop Length
        </ThemedText>
        <SegmentedControl
          options={LOOP_LENGTH_OPTIONS}
          value={idea.loopLengthBars}
          getLabel={(option) => `${option} ${option === 1 ? 'Bar' : 'Bars'}`}
          onChange={(loopLengthBars) => updateSettings(ideaId, { loopLengthBars })}
        />
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionLabel} themeColor="textSecondary">
          Metronome
        </ThemedText>
        <View style={styles.metronomeRow}>
          <ThemedText style={Typography.body}>Count-in before recording</ThemedText>
          <Switch
            accessibilityLabel="Count-in before recording"
            value={idea.metronomeEnabled}
            onValueChange={(metronomeEnabled) => updateSettings(ideaId, { metronomeEnabled })}
            trackColor={{ true: theme.accent }}
          />
        </View>
      </View>
    </ThemedView>
  );
}

function StepperButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: 'minus' | 'plus';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.stepperButton,
        { backgroundColor: theme.backgroundElement, opacity: disabled ? 0.3 : 1 },
      ]}
    >
      <SymbolView name={icon} tintColor={theme.text} size={20} />
    </Pressable>
  );
}

function EditableTempoValue({
  tempo,
  onSubmit,
}: {
  tempo: number;
  onSubmit: (tempo: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <TempoTextInput
        initialTempo={tempo}
        onSubmit={(next) => {
          onSubmit(next);
          setIsEditing(false);
        }}
      />
    );
  }

  return (
    <Pressable accessibilityLabel="Edit tempo" onPress={() => setIsEditing(true)}>
      <ThemedText style={styles.tempoNumber}>{tempo}</ThemedText>
    </Pressable>
  );
}

/** Mounted only while editing, so its local state starts fresh from `initialTempo` each time. */
function TempoTextInput({
  initialTempo,
  onSubmit,
}: {
  initialTempo: number;
  onSubmit: (tempo: number) => void;
}) {
  const theme = useTheme();
  const [draftValue, setDraftValue] = useState(String(initialTempo));

  function handleSubmit() {
    const parsed = parseInt(draftValue, 10);
    const clamped = Number.isFinite(parsed)
      ? Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, parsed))
      : initialTempo;
    onSubmit(clamped);
  }

  return (
    <TextInput
      autoFocus
      value={draftValue}
      onChangeText={setDraftValue}
      onSubmitEditing={handleSubmit}
      onBlur={handleSubmit}
      selectTextOnFocus
      keyboardType="number-pad"
      returnKeyType="done"
      maxLength={3}
      style={[styles.tempoNumber, styles.tempoInput, { color: theme.text }]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.five,
  },
  doneLabel: {
    ...Typography.headline,
  },
  section: {
    gap: Spacing.two,
  },
  sectionLabel: {
    ...Typography.footnote,
    textTransform: 'uppercase',
  },
  tempoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
  },
  metronomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tempoValue: {
    alignItems: 'center',
    minWidth: 100,
  },
  tempoNumber: {
    ...Typography.largeTitle,
  },
  tempoInput: {
    padding: 0,
    textAlign: 'center',
    minWidth: 80,
  },
  tempoUnit: {
    ...Typography.footnote,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
