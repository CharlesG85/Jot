import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
}

export function SearchField({ value, onChangeText }: SearchFieldProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement }]}>
      <SymbolView name="magnifyingglass" tintColor={theme.textSecondary} size={18} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search Ideas"
        placeholderTextColor={theme.textSecondary}
        returnKeyType="search"
        autoCorrect={false}
        style={[styles.input, { color: theme.text }]}
      />
      {value.length > 0 && (
        <Pressable accessibilityLabel="Clear search" onPress={() => onChangeText('')}>
          <SymbolView name="xmark.circle.fill" tintColor={theme.textSecondary} size={18} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    height: 40,
  },
  input: {
    flex: 1,
    ...Typography.body,
    padding: 0,
  },
});
