import Database from 'better-sqlite3';
import { getSqlitePath } from '../../dataRoot.js';
import { importLegacyJsonIfNeeded } from './importLegacyJson.js';
import { applyMigrations } from './migrate.js';

/** @type {import('better-sqlite3').Database | null} */
let dbInstance = null;

/**
 * Shared SQLite connection (lazy). Runs migrations and one-time JSON import when first opened.
 * @returns {import('better-sqlite3').Database}
 */
export function getDb() {
  if (!dbInstance) {
    const path = getSqlitePath();
    dbInstance = new Database(path);
    dbInstance.pragma('journal_mode = WAL');
    applyMigrations(dbInstance);
    importLegacyJsonIfNeeded(dbInstance);
  }
  return dbInstance;
}

/**
 * Close DB (for tests or process teardown).
 */
export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Delete all library and collection rows (for tests).
 */
export function clearAllPersistenceTables() {
  const db = getDb();
  db.exec('DELETE FROM library_items; DELETE FROM collection_cache;');
}
