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
  abortControllerByLayerId: Map<string, AbortController>;
  /**
   * Marks layerId as entering `phase` and returns an AbortSignal the
   * operation should watch — see cancel(). Record → retake → delete is a
   * common workflow (see cancel()'s own docstring), so every background
   * operation this store tracks is expected to be cancellable, not just
   * observable.
   */
  start: (layerId: string, phase: LayerProcessingPhase) => AbortSignal;
  finish: (layerId: string) => void;
  /**
   * Aborts whatever background operation is currently running for
   * layerId — a no-op if nothing is in flight. Called right before deleting
   * a Layer: MIDI analysis alone can take as long as the recording's own
   * duration (it works by replaying the audio), and record → retake →
   * delete is a common enough workflow that letting an already-doomed
   * analysis run to completion for a Layer that's about to stop existing
   * would waste real, repeated seconds of work rather than just an
   * occasional edge case.
   */
  cancel: (layerId: string) => void;
}

export const useMidiProcessingStore = create<MidiProcessingState>((set, get) => ({
  phaseByLayerId: new Map(),
  abortControllerByLayerId: new Map(),

  start: (layerId, phase) => {
    const controller = new AbortController();
    set((state) => {
      const nextPhase = new Map(state.phaseByLayerId);
      nextPhase.set(layerId, phase);
      const nextControllers = new Map(state.abortControllerByLayerId);
      nextControllers.set(layerId, controller);
      return { phaseByLayerId: nextPhase, abortControllerByLayerId: nextControllers };
    });
    return controller.signal;
  },

  finish: (layerId) =>
    set((state) => {
      if (!state.phaseByLayerId.has(layerId) && !state.abortControllerByLayerId.has(layerId)) {
        return state;
      }
      const nextPhase = new Map(state.phaseByLayerId);
      nextPhase.delete(layerId);
      const nextControllers = new Map(state.abortControllerByLayerId);
      nextControllers.delete(layerId);
      return { phaseByLayerId: nextPhase, abortControllerByLayerId: nextControllers };
    }),

  cancel: (layerId) => {
    get().abortControllerByLayerId.get(layerId)?.abort();
  },
}));

/** Whether background MIDI analysis or instrument rendering is currently running for this Layer, or null if idle. */
export function useLayerProcessingPhase(layerId: string): LayerProcessingPhase | null {
  return useMidiProcessingStore((state) => state.phaseByLayerId.get(layerId) ?? null);
}
