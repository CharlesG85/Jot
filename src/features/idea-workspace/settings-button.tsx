import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

interface SettingsButtonProps {
  ideaId: string;
}

/** Opens the Idea Settings sheet (tempo, time signature, loop length). */
export function SettingsButton({ ideaId }: SettingsButtonProps) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Pressable
      accessibilityLabel="Idea settings"
      onPress={() => router.push({ pathname: '/idea/[id]/settings', params: { id: ideaId } })}
      style={styles.button}
    >
      <SymbolView name="gearshape" tintColor={theme.text} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 4,
  },
});
