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
  metronome_enabled INTEGER NOT NULL DEFAULT 1,
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
  duration_seconds REAL NOT NULL DEFAULT 0,
  loop_length_bars INTEGER NOT NULL DEFAULT 1,
  midi_data TEXT,
  position INTEGER NOT NULL DEFAULT 0,
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
      await migrateLayerPositionColumn(db);
      await migrateIdeaMetronomeColumn(db);
      await migrateLayerLoopMetadataColumns(db);
      return db;
    });
  }
  return databasePromise;
}

/**
 * `CREATE TABLE IF NOT EXISTS` is a no-op against a `layers` table that
 * already existed before `position` was added, so installs from before
 * Stage 5 need an explicit ALTER TABLE + backfill in creation order.
 */
async function migrateLayerPositionColumn(db: SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(layers)');
  const hasPosition = columns.some((column) => column.name === 'position');
  if (hasPosition) {
    return;
  }

  await db.execAsync(`
    ALTER TABLE layers ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

    UPDATE layers
    SET position = (
      SELECT COUNT(*) - 1
      FROM layers AS other
      WHERE other.idea_id = layers.idea_id
        AND (
          other.created_at < layers.created_at
          OR (other.created_at = layers.created_at AND other.id <= layers.id)
        )
    );
  `);
}

/**
 * Same rationale as `migrateLayerPositionColumn`: installs from before
 * Stage 7 need an explicit ALTER TABLE to pick up the metronome toggle.
 * Backfills to enabled, matching the default for new Ideas.
 */
async function migrateIdeaMetronomeColumn(db: SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(ideas)');
  const hasMetronomeEnabled = columns.some((column) => column.name === 'metronome_enabled');
  if (hasMetronomeEnabled) {
    return;
  }

  await db.execAsync(`
    ALTER TABLE ideas ADD COLUMN metronome_enabled INTEGER NOT NULL DEFAULT 1;
  `);
}

/**
 * Installs from before Stage 6.5 need duration/loop-length metadata added.
 * Their original files remain fully intact either way — this only affects
 * playback looping. `duration_seconds` can't be recovered without reading
 * every existing file, so it's left at 0; `loop_length_bars` defaults to 1
 * bar, which is a safe (if imprecise) starting point until each Layer is
 * re-recorded.
 */
async function migrateLayerLoopMetadataColumns(db: SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(layers)');
  const hasLoopLengthBars = columns.some((column) => column.name === 'loop_length_bars');
  if (hasLoopLengthBars) {
    return;
  }

  await db.execAsync(`
    ALTER TABLE layers ADD COLUMN duration_seconds REAL NOT NULL DEFAULT 0;
    ALTER TABLE layers ADD COLUMN loop_length_bars INTEGER NOT NULL DEFAULT 1;
  `);
}
