export interface PitchDetectionResult {
  /** Detected frequency in Hz, or null if this frame has no clear pitch. */
  frequency: number | null;
  /**
   * The detector's own confidence in this reading, 0-1. Not yet consumed
   * anywhere downstream (see pitch-to-midi.ts's silence/voice-activity
   * gating, which is still RMS-only) — carried through the interface now so
   * confidence-based gating can be added later without another interface
   * change.
   */
  confidence: number;
}

/**
 * A monophonic, per-frame pitch detector. Different implementations require
 * different input sample rates and frame sizes (CREPE's is a fixed model
 * contract; YIN's is a tunable analysis parameter) — exposing both lets the
 * orchestrating pipeline (pitch-to-midi.ts) resample and window audio
 * generically, with zero knowledge of which detector it's driving.
 */
export interface PitchDetector {
  /** Sample rate, in Hz, that frames passed to detectPitch() must be at. */
  readonly sampleRate: number;
  /** Exact number of samples per frame that detectPitch() requires. */
  readonly frameSize: number;
  /**
   * Analyzes one frame — exactly `frameSize` samples at `sampleRate` — and
   * returns its detected pitch. Called sequentially, once per analysis hop;
   * implementations that hold shared native state (e.g. an inference
   * session) don't need to guard against concurrent calls.
   */
  detectPitch(frame: Float32Array): Promise<PitchDetectionResult>;
}
