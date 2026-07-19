import type { Idea } from '@/models/idea';
import type { Layer } from '@/models/layer';

/**
 * Thrown by updateLayer when the target row no longer exists — most
 * commonly because the user deleted the Layer while a background operation
 * (MIDI analysis, instrument rendering, re-quantization) was still in
 * flight against it. Callers running in the background should catch this
 * specifically and treat it as an expected, benign outcome — there's
 * nothing left to update — rather than a real failure.
 */
export class LayerNotFoundError extends Error {
  constructor(id: string) {
    super(`Layer not found: ${id}`);
    this.name = 'LayerNotFoundError';
  }
}

/**
 * The only interface UI/hooks should use to persist Ideas, Layers, and
 * recordings. Concrete implementation is backed by SQLite + the file
 * system (see src/storage) but callers must never depend on that directly.
 * See docs/02_TECH_SPEC.md §8-9.
 */
export interface StorageService {
  listIdeas(): Promise<Idea[]>;
  getIdea(id: string): Promise<Idea | null>;
  createIdea(input: Pick<Idea, 'title'>): Promise<Idea>;
  /** Updates content fields (lyrics, timing, etc). Bumps `updatedAt`, which resorts the Idea list. */
  updateIdea(id: string, changes: Partial<Omit<Idea, 'id' | 'createdAt'>>): Promise<Idea>;
  /** Renames only. Does not bump `updatedAt` — a title change alone shouldn't reorder the list. */
  renameIdea(id: string, title: string): Promise<Idea>;
  /** Bumps `updatedAt` without changing any fields — for edits that happen through a Layer, not the Idea row itself. */
  touchIdea(id: string): Promise<void>;
  deleteIdea(id: string): Promise<void>;

  listLayers(ideaId: string): Promise<Layer[]>;
  createLayer(ideaId: string, input: Pick<Layer, 'name'>): Promise<Layer>;
  /** @throws LayerNotFoundError if `id` no longer exists (e.g. deleted while a background operation was in flight). */
  updateLayer(
    id: string,
    changes: Partial<Omit<Layer, 'id' | 'ideaId' | 'createdAt'>>,
  ): Promise<Layer>;
  /** Assigns sequential positions matching the given order. */
  reorderLayers(ideaId: string, orderedLayerIds: string[]): Promise<void>;
  deleteLayer(id: string): Promise<void>;

  /** Persists raw recording bytes for a Layer and returns the saved file's local path. */
  saveRecording(layerId: string, data: Uint8Array): Promise<string>;
  /** Persists rendered instrument audio bytes for a Layer and returns the saved file's local path. See midi-render-service.ts. */
  saveRenderedAudio(layerId: string, data: Uint8Array): Promise<string>;
  /** Deletes a file at the given path if it exists — used for both original recordings and rendered audio. */
  deleteAudioFile(path: string): Promise<void>;
}
