import { useLocalSearchParams } from 'expo-router';

import { SettingsSheet } from '@/features/idea-workspace/settings-sheet';

export default function IdeaSettingsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SettingsSheet ideaId={id} />;
}
