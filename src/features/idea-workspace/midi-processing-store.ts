import { create } from 'zustand';

/**
 * Tracks which Layers currently have a background MIDI operation running —
 * Stage 8's pitch-detection analysis, or Stage 9's instrument render.
 * Ephemeral, in-memory only, not persisted: if the app is killed
 * mid-operation, the operation really did stop, so resetting to "nothing in
 * progress" on relaunch is the correct answer, not a bug to reconcile.
 */
export type LayerProcessingPhase = 'analyzing' | 'rendering';

interface MidiProcessingState {
  phaseByLayerId: Map<string, LayerProcessingPhase>;
  start: (layerId: string, phase: LayerProcessingPhase) => void;
  finish: (layerId: string) => void;
}

export const useMidiProcessingStore = create<MidiProcessingState>((set) => ({
  phaseByLayerId: new Map(),

  start: (layerId, phase) =>
    set((state) => {
      const next = new Map(state.phaseByLayerId);
      next.set(layerId, phase);
      return { phaseByLayerId: next };
    }),

  finish: (layerId) =>
    set((state) => {
      if (!state.phaseByLayerId.has(layerId)) {
        return state;
      }
      const next = new Map(state.phaseByLayerId);
      next.delete(layerId);
      return { phaseByLayerId: next };
    }),
}));

/** Whether background MIDI analysis or instrument rendering is currently running for this Layer, or null if idle. */
export function useLayerProcessingPhase(layerId: string): LayerProcessingPhase | null {
  return useMidiProcessingStore((state) => state.phaseByLayerId.get(layerId) ?? null);
}
