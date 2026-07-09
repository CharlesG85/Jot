import { Directory, Paths } from 'expo-file-system';

/** Local directory where Layer recordings are saved. Never synced to SQLite directly. */
export const recordingsDirectory = new Directory(Paths.document, 'recordings');

/** Creates the recordings directory if it doesn't already exist. Safe to call repeatedly. */
export function ensureRecordingsDirectory(): void {
  if (!recordingsDirectory.exists) {
    recordingsDirectory.create({ intermediates: true });
  }
}
