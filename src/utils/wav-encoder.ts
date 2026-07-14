const BITS_PER_SAMPLE = 16;
const NUM_CHANNELS = 1;
const HEADER_BYTES = 44;

function writeString(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

/**
 * Encodes mono Float32 samples (-1..1) as a canonical 16-bit PCM WAV file —
 * a 44-byte RIFF/`fmt `/`data` header with no extra chunks, hand-written
 * rather than produced by any recorder/library. This is deliberate: the
 * WAV playback bug hit earlier in this project (`FigFilePlayer err=-12864`)
 * was very likely caused by non-standard `JUNK`/`FLLR` padding chunks that
 * `AVAudioRecorder` writes into its own WAV output, not WAV as a format —
 * a minimal, chunk-free header sidesteps that specific risk.
 */
export function encodeWavPcm16(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataBytes = samples.length * (BITS_PER_SAMPLE / 8);
  const buffer = new ArrayBuffer(HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);
  const byteRate = sampleRate * NUM_CHANNELS * (BITS_PER_SAMPLE / 8);
  const blockAlign = NUM_CHANNELS * (BITS_PER_SAMPLE / 8);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // audio format: PCM
  view.setUint16(22, NUM_CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const intSample = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(HEADER_BYTES + i * 2, Math.round(intSample), true);
  }

  return new Uint8Array(buffer);
}
