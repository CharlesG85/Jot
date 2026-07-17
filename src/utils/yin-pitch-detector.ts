import Pitchfinder from 'pitchfinder';

import type { PitchDetectionResult, PitchDetector } from '@/utils/pitch-detector';

// YIN needs several cycles of the lowest expected frequency to track
// reliably — this is longer than the pipeline's analysis hop (see HOP_MS in
// pitch-to-midi.ts), which is why frames overlap.
const WINDOW_MS = 40;

/**
 * Wraps `pitchfinder`'s YIN detector behind the `PitchDetector` interface.
 * Superseded by CrepePitchDetector as the pipeline's default (see
 * pitch-to-midi.ts) but kept for direct comparison against CREPE's output.
 */
export class YinPitchDetector implements PitchDetector {
  readonly sampleRate: number;
  readonly frameSize: number;
  private readonly detect: (frame: Float32Array) => number | null;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.frameSize = Math.max(1, Math.round((sampleRate * WINDOW_MS) / 1000));
    this.detect = Pitchfinder.YIN({ sampleRate });
  }

  async detectPitch(frame: Float32Array): Promise<PitchDetectionResult> {
    const frequency = this.detect(frame);
    // YIN has no native confidence measure — a clean detection is reported
    // at full confidence, a miss at zero, rather than fabricating a
    // continuous value the algorithm doesn't actually produce.
    return { frequency, confidence: frequency !== null ? 1 : 0 };
  }
}
