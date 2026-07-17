import type { InferenceSession } from 'onnxruntime-react-native';

import type { PitchDetectionResult, PitchDetector } from '@/utils/pitch-detector';

// CREPE's fixed model contract — not a tunable analysis parameter the way
// YIN's window size is. Every input frame must be exactly this shape.
const SAMPLE_RATE = 16000;
const FRAME_SIZE = 1024;

// Standard CREPE pitch-bin decode constants (see onnxcrepe/convert.py,
// converted from the original CREPE paper's TensorFlow implementation):
// 360 output bins, 20 cents each, offset from a 10Hz reference.
const PITCH_BINS = 360;
const CENTS_PER_BIN = 20;
const CENTS_OFFSET = 1997.3794084376191;

// How many bins on either side of the argmax are folded into the
// weighted-average decode — gives sub-bin frequency precision instead of
// snapping to one of 360 discrete steps (~1.2% apart). Matches the radius
// commonly used by reference CREPE decoders.
const DECODE_WEIGHT_RADIUS = 4;

function binsToHz(bin: number): number {
  const cents = CENTS_PER_BIN * bin + CENTS_OFFSET;
  return 10 * Math.pow(2, cents / 1200);
}

/**
 * Decodes CREPE's 360-bin output into a single (frequency, confidence) pair.
 * The peak bin's own probability is reported as confidence; the frequency
 * itself is a probability-weighted average of the bins around the peak
 * (sub-bin precision), not the peak bin alone.
 */
function decodeProbabilities(probabilities: Float32Array): PitchDetectionResult {
  let bestBin = 0;
  let bestProb = -Infinity;
  for (let i = 0; i < probabilities.length; i++) {
    if (probabilities[i] > bestProb) {
      bestProb = probabilities[i];
      bestBin = i;
    }
  }

  const start = Math.max(0, bestBin - DECODE_WEIGHT_RADIUS);
  const end = Math.min(probabilities.length - 1, bestBin + DECODE_WEIGHT_RADIUS);
  let weightedBinSum = 0;
  let weightSum = 0;
  for (let i = start; i <= end; i++) {
    weightedBinSum += i * probabilities[i];
    weightSum += probabilities[i];
  }
  const weightedBin = weightSum > 0 ? weightedBinSum / weightSum : bestBin;

  return { frequency: binsToHz(weightedBin), confidence: bestProb };
}

// Shared across every CrepePitchDetector instance so the model is only
// loaded and the inference session only created once per app session, not
// once per conversion.
let sessionPromise: Promise<InferenceSession> | null = null;

// onnxruntime-react-native and expo-asset are imported dynamically, not at
// module scope — both pull in react-native's own module graph, which can't
// be loaded outside a React Native runtime (e.g. a plain-Node throwaway
// verification script for the pure orchestration logic in pitch-to-midi.ts).
// Deferring the import here means that logic can be exercised with a mock
// PitchDetector without ever touching this file's native dependencies.
function getSession(): Promise<InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const [{ Asset }, { InferenceSession }] = await Promise.all([
        import('expo-asset'),
        import('onnxruntime-react-native'),
      ]);
      // require() resolves via metro.config.js's 'onnx' assetExt registration.
      const asset = Asset.fromModule(require('@/assets/models/crepe-tiny.onnx'));
      await asset.downloadAsync();
      if (!asset.localUri) {
        throw new Error('CREPE model asset has no localUri after downloadAsync()');
      }
      return InferenceSession.create(asset.localUri);
    })();
  }
  return sessionPromise;
}

/**
 * CREPE Tiny, run locally via ONNX Runtime. ONNX Runtime was chosen over
 * react-native-executorch after a device-latency spike: ~3.4ms/frame vs
 * ~58ms/frame on the same physical iPhone for this model, which matters
 * because the pipeline runs one inference per analysis hop (~15ms of
 * audio) — react-native-executorch's default (unaccelerated) CPU export
 * couldn't keep pace with that hop rate.
 */
export class CrepePitchDetector implements PitchDetector {
  readonly sampleRate = SAMPLE_RATE;
  readonly frameSize = FRAME_SIZE;

  async detectPitch(frame: Float32Array): Promise<PitchDetectionResult> {
    const session = await getSession();
    const { Tensor } = await import('onnxruntime-react-native');
    // onnxruntime-react-native's native tensor construction reads from byte
    // 0 of the TypedArray's underlying ArrayBuffer — it never applies the
    // TypedArray's own byteOffset (confirmed in its TensorUtils.cpp:
    // `dataObj.getProperty("buffer").getArrayBuffer(runtime); data =
    // buffer.data(runtime)`, with no offset). `frame` here is produced by
    // `.subarray()` in pitch-to-midi.ts's frame loop, which is a view with a
    // non-zero byteOffset for every frame after the first — without this
    // copy, every frame's inference would silently run on the recording's
    // first 1024 samples regardless of which window was actually intended.
    const contiguousFrame = Float32Array.from(frame);
    const output = await session.run({
      frames: new Tensor('float32', contiguousFrame, [1, FRAME_SIZE]),
    });
    const outputName = Object.keys(output)[0];
    const probabilities = output[outputName].data as Float32Array;
    if (probabilities.length !== PITCH_BINS) {
      throw new Error(
        `Unexpected CREPE output shape: got ${probabilities.length} bins, expected ${PITCH_BINS}`,
      );
    }
    return decodeProbabilities(probabilities);
  }
}
