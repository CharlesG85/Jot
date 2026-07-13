type AudioObjectKind = 'player' | 'recorder';
type AudioLifecycleEvent = 'create' | 'destroy' | 'prepare' | 'play' | 'record' | 'stop' | 'pause';

const activeCounts: Record<AudioObjectKind, number> = { player: 0, recorder: 0 };

function printActiveCounts(): void {
  console.log('[audio-lifecycle] active counts', JSON.stringify(activeCounts));
}

/**
 * Instrumentation only. Logs a single native audio object lifecycle event.
 * For 'create'/'destroy' it also updates and prints the running count of
 * active players/recorders. Not wired into any production logic.
 */
export function logAudioLifecycle(
  kind: AudioObjectKind,
  event: AudioLifecycleEvent,
  id: string,
  label: string,
): void {
  console.log(`[audio-lifecycle] ${kind} ${event}`, { id, label });

  if (event === 'create') {
    activeCounts[kind] += 1;
    printActiveCounts();
  } else if (event === 'destroy') {
    activeCounts[kind] = Math.max(0, activeCounts[kind] - 1);
    printActiveCounts();
  }
}
