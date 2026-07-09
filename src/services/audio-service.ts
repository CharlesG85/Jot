/** Mirrors the Record button states from docs/01_UI_SPEC.md. */
export type PlaybackState = 'idle' | 'recording' | 'playing' | 'processing';

/**
 * The only interface UI/hooks should use to record and play audio. UI must
 * never talk to native audio APIs directly (docs/02_TECH_SPEC.md §8). The
 * concrete implementation (wrapping the native audio engine) arrives in
 * docs/03_ROADMAP.md Stage 4.
 */
export interface AudioService {
  requestPermissions(): Promise<boolean>;

  startRecording(layerId: string): Promise<void>;
  stopRecording(): Promise<{ uri: string; durationMs: number }>;

  play(ideaId: string): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;

  setLayerVolume(layerId: string, volume: number): void;
  setLayerMuted(layerId: string, muted: boolean): void;
  setLayerSolo(layerId: string, solo: boolean): void;
}
