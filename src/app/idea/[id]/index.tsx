import { useLocalSearchParams } from 'expo-router';

import { WorkspaceScreen } from '@/features/idea-workspace/workspace-screen';

export default function IdeaRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WorkspaceScreen ideaId={id} />;
}
