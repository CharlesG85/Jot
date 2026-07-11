/**
 * Recording and playback are implemented as React hooks
 * (src/features/idea-workspace/use-layer-recorder.ts, and `useAudioPlayer`
 * directly inside src/features/idea-workspace/layer-card.tsx), not a
 * class-based service like StorageService.
 *
 * `expo-audio`'s own primitives (`useAudioRecorder`, `useAudioPlayer`) are
 * hooks, and — unlike storage, which many independent screens call —
 * recording and playback are only ever driven from the Idea Workspace.
 * A hook is the idiomatic fit here, not a compromise. See
 * docs/03_ROADMAP.md Stage 4.
 */
export type RecordingPhase = 'idle' | 'counting-in' | 'recording' | 'processing';
