import type { Idea } from '@/models/idea';
import type { Layer } from '@/models/layer';

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
  deleteIdea(id: string): Promise<void>;

  listLayers(ideaId: string): Promise<Layer[]>;
  createLayer(ideaId: string, input: Pick<Layer, 'name'>): Promise<Layer>;
  updateLayer(
    id: string,
    changes: Partial<Omit<Layer, 'id' | 'ideaId' | 'createdAt'>>,
  ): Promise<Layer>;
  deleteLayer(id: string): Promise<void>;

  /** Persists raw recording bytes for a Layer and returns the saved file's local path. */
  saveRecording(layerId: string, data: Uint8Array): Promise<string>;
  deleteRecording(path: string): Promise<void>;
}
