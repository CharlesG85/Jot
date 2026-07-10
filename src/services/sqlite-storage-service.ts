import { File } from 'expo-file-system';

import {
  DEFAULT_LOOP_LENGTH_BARS,
  DEFAULT_TEMPO,
  DEFAULT_TIME_SIGNATURE,
  type Idea,
  type TimeSignature,
} from '@/models/idea';
import type { Layer } from '@/models/layer';
import type { StorageService } from '@/services/storage-service';
import { getDatabase } from '@/storage/database';
import { recordingsDirectory } from '@/storage/file-system';
import { generateId } from '@/utils/id';

interface IdeaRow {
  id: string;
  title: string;
  lyrics: string;
  tempo: number;
  time_signature: string;
  loop_length_bars: number;
  created_at: number;
  updated_at: number;
}

interface LayerRow {
  id: string;
  idea_id: string;
  name: string;
  instrument: string | null;
  muted: number;
  solo: number;
  volume: number;
  audio_path: string | null;
  midi_data: string | null;
  position: number;
  created_at: number;
  updated_at: number;
}

function mapIdea(row: IdeaRow): Idea {
  return {
    id: row.id,
    title: row.title,
    lyrics: row.lyrics,
    tempo: row.tempo,
    timeSignature: row.time_signature as TimeSignature,
    loopLengthBars: row.loop_length_bars,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLayer(row: LayerRow): Layer {
  return {
    id: row.id,
    ideaId: row.idea_id,
    name: row.name,
    instrument: row.instrument,
    muted: row.muted === 1,
    solo: row.solo === 1,
    volume: row.volume,
    audioPath: row.audio_path,
    midiData: row.midi_data,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class SqliteStorageService implements StorageService {
  async listIdeas(): Promise<Idea[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<IdeaRow>('SELECT * FROM ideas ORDER BY updated_at DESC');
    return rows.map(mapIdea);
  }

  async getIdea(id: string): Promise<Idea | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<IdeaRow>('SELECT * FROM ideas WHERE id = ?', id);
    return row ? mapIdea(row) : null;
  }

  async createIdea(input: Pick<Idea, 'title'>): Promise<Idea> {
    const db = await getDatabase();
    const now = Date.now();
    const idea: Idea = {
      id: generateId(),
      title: input.title,
      lyrics: '',
      tempo: DEFAULT_TEMPO,
      timeSignature: DEFAULT_TIME_SIGNATURE,
      loopLengthBars: DEFAULT_LOOP_LENGTH_BARS,
      createdAt: now,
      updatedAt: now,
    };
    await db.runAsync(
      `INSERT INTO ideas (id, title, lyrics, tempo, time_signature, loop_length_bars, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      idea.id,
      idea.title,
      idea.lyrics,
      idea.tempo,
      idea.timeSignature,
      idea.loopLengthBars,
      idea.createdAt,
      idea.updatedAt,
    );
    return idea;
  }

  async updateIdea(id: string, changes: Partial<Omit<Idea, 'id' | 'createdAt'>>): Promise<Idea> {
    const db = await getDatabase();
    const existing = await this.getIdea(id);
    if (!existing) {
      throw new Error(`Idea not found: ${id}`);
    }
    const updated: Idea = { ...existing, ...changes, updatedAt: Date.now() };
    await db.runAsync(
      `UPDATE ideas
       SET title = ?, lyrics = ?, tempo = ?, time_signature = ?, loop_length_bars = ?, updated_at = ?
       WHERE id = ?`,
      updated.title,
      updated.lyrics,
      updated.tempo,
      updated.timeSignature,
      updated.loopLengthBars,
      updated.updatedAt,
      id,
    );
    return updated;
  }

  async renameIdea(id: string, title: string): Promise<Idea> {
    const db = await getDatabase();
    const existing = await this.getIdea(id);
    if (!existing) {
      throw new Error(`Idea not found: ${id}`);
    }
    await db.runAsync('UPDATE ideas SET title = ? WHERE id = ?', title, id);
    return { ...existing, title };
  }

  async touchIdea(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE ideas SET updated_at = ? WHERE id = ?', Date.now(), id);
  }

  async deleteIdea(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM ideas WHERE id = ?', id);
  }

  async listLayers(ideaId: string): Promise<Layer[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<LayerRow>(
      'SELECT * FROM layers WHERE idea_id = ? ORDER BY position ASC',
      ideaId,
    );
    return rows.map(mapLayer);
  }

  async createLayer(ideaId: string, input: Pick<Layer, 'name'>): Promise<Layer> {
    const db = await getDatabase();
    const now = Date.now();
    const nextPosition = await db.getFirstAsync<{ nextPosition: number }>(
      'SELECT COALESCE(MAX(position), -1) + 1 AS nextPosition FROM layers WHERE idea_id = ?',
      ideaId,
    );
    const layer: Layer = {
      id: generateId(),
      ideaId,
      name: input.name,
      instrument: null,
      muted: false,
      solo: false,
      volume: 1,
      audioPath: null,
      midiData: null,
      position: nextPosition?.nextPosition ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    await db.runAsync(
      `INSERT INTO layers (id, idea_id, name, instrument, muted, solo, volume, audio_path, midi_data, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      layer.id,
      layer.ideaId,
      layer.name,
      layer.instrument,
      layer.muted ? 1 : 0,
      layer.solo ? 1 : 0,
      layer.volume,
      layer.audioPath,
      layer.midiData,
      layer.position,
      layer.createdAt,
      layer.updatedAt,
    );
    return layer;
  }

  async updateLayer(
    id: string,
    changes: Partial<Omit<Layer, 'id' | 'ideaId' | 'createdAt'>>,
  ): Promise<Layer> {
    const db = await getDatabase();
    const existing = await db.getFirstAsync<LayerRow>('SELECT * FROM layers WHERE id = ?', id);
    if (!existing) {
      throw new Error(`Layer not found: ${id}`);
    }
    const updated: Layer = { ...mapLayer(existing), ...changes, updatedAt: Date.now() };
    await db.runAsync(
      `UPDATE layers
       SET name = ?, instrument = ?, muted = ?, solo = ?, volume = ?, audio_path = ?, midi_data = ?, position = ?, updated_at = ?
       WHERE id = ?`,
      updated.name,
      updated.instrument,
      updated.muted ? 1 : 0,
      updated.solo ? 1 : 0,
      updated.volume,
      updated.audioPath,
      updated.midiData,
      updated.position,
      updated.updatedAt,
      id,
    );
    return updated;
  }

  async reorderLayers(ideaId: string, orderedLayerIds: string[]): Promise<void> {
    const db = await getDatabase();
    for (const [index, id] of orderedLayerIds.entries()) {
      await db.runAsync(
        'UPDATE layers SET position = ? WHERE id = ? AND idea_id = ?',
        index,
        id,
        ideaId,
      );
    }
  }

  async deleteLayer(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM layers WHERE id = ?', id);
  }

  async saveRecording(layerId: string, data: Uint8Array): Promise<string> {
    const file = new File(recordingsDirectory, `${layerId}.m4a`);
    file.write(data);
    return file.uri;
  }

  async deleteRecording(path: string): Promise<void> {
    const file = new File(path);
    if (file.exists) {
      file.delete();
    }
  }
}

export const storageService: StorageService = new SqliteStorageService();
