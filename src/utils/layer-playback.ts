import type { Layer } from '@/models/layer';

/**
 * The single point where playback decides which audio file to use for a
 * Layer — the rendered instrument audio when MIDI is enabled and a valid
 * render exists, otherwise the original recording. Every playback call site
 * (Idea playback, Layer preview) resolves through this instead of reading
 * `layer.audioPath` directly, so the playback engine itself never needs to
 * know MIDI exists — see docs/03_ROADMAP.md Stage 9.
 *
 * Export intentionally does not use this — it always shares the original
 * recording, not the rendered audio (out of scope for this stage).
 */
export function getLayerPlaybackPath(layer: Layer): string | null {
  const resolvedPath =
    layer.midiEnabled && layer.renderedAudioPath ? layer.renderedAudioPath : layer.audioPath;
  console.log('[midi-debug] stage 5: playback path resolution', {
    layerId: layer.id,
    midiEnabled: layer.midiEnabled,
    renderedAudioPath: layer.renderedAudioPath,
    audioPath: layer.audioPath,
    resolvedPath,
  });
  return resolvedPath;
}
