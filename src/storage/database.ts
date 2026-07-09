import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

/**
 * Schema for the `ideas` and `layers` tables. Audio recordings themselves
 * are never stored here — only metadata and a path into the file system.
 * See docs/02_TECH_SPEC.md §9 and docs/07_AUDIO_ARCHITECTURE.md §9.
 */
const MIGRATION_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ideas (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  lyrics TEXT NOT NULL DEFAULT '',
  tempo INTEGER NOT NULL DEFAULT 60,
  time_signature TEXT NOT NULL DEFAULT '4/4',
  loop_length_bars INTEGER NOT NULL DEFAULT 4,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS layers (
  id TEXT PRIMARY KEY NOT NULL,
  idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  instrument TEXT,
  muted INTEGER NOT NULL DEFAULT 0,
  solo INTEGER NOT NULL DEFAULT 0,
  volume REAL NOT NULL DEFAULT 1,
  audio_path TEXT,
  midi_data TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_layers_idea_id ON layers(idea_id);
`;

const DATABASE_NAME = 'jot.db';

let databasePromise: Promise<SQLiteDatabase> | null = null;

/** Opens (and lazily migrates) the app's single SQLite database. */
export function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await db.execAsync(MIGRATION_SQL);
      return db;
    });
  }
  return databasePromise;
}
