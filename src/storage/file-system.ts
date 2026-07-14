import { Directory, Paths } from 'expo-file-system';

/** Local directory where Layer recordings are saved. Never synced to SQLite directly. */
export const recordingsDirectory = new Directory(Paths.document, 'recordings');

/** Local directory where rendered instrument audio (Stage 9) is cached — derived, regenerable, never the original recording. */
export const rendersDirectory = new Directory(Paths.document, 'renders');

/** Creates the recordings directory if it doesn't already exist. Safe to call repeatedly. */
export function ensureRecordingsDirectory(): void {
  if (!recordingsDirectory.exists) {
    recordingsDirectory.create({ intermediates: true });
  }
}

/** Creates the renders directory if it doesn't already exist. Safe to call repeatedly. */
export function ensureRendersDirectory(): void {
  if (!rendersDirectory.exists) {
    rendersDirectory.create({ intermediates: true });
  }
}
