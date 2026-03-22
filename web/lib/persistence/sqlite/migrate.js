import {
  normalizeLibraryItemTrackBpms,
  normalizeSetlistTrackBpms,
} from '../../../../core/domain/library.js';

/**
 * Apply schema migrations in order.
 * @param {import('better-sqlite3').Database} db
 */
export function applyMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS library_items (
      id TEXT PRIMARY KEY NOT NULL,
      discogs_id TEXT,
      item_json TEXT NOT NULL,
      added_at TEXT,
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_library_items_discogs_id ON library_items(discogs_id);

    CREATE TABLE IF NOT EXISTS collection_cache (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      payload_json TEXT NOT NULL
    );
  `);

  const row = db
    .prepare(
      'SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1',
    )
    .get();
  const current = row?.version ?? 0;
  if (current < 1) {
    db.prepare('INSERT INTO schema_migrations (version) VALUES (1)').run();
  }
  if (current < 2) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL DEFAULT ''
      );
    `);
    db.prepare('INSERT INTO schema_migrations (version) VALUES (2)').run();
  }
  if (current < 3) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS setlists (
        id TEXT PRIMARY KEY NOT NULL,
        setlist_json TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT
      );
    `);
    db.prepare('INSERT INTO schema_migrations (version) VALUES (3)').run();
  }
  if (current < 4) {
    const now = new Date().toISOString();
    const tx = db.transaction(() => {
      const libRows = db.prepare('SELECT id, item_json FROM library_items').all();
      const updateLib = db.prepare(
        'UPDATE library_items SET item_json = ?, updated_at = ? WHERE id = ?',
      );
      for (const row of libRows) {
        let item;
        try {
          item = JSON.parse(row.item_json);
        } catch {
          continue;
        }
        if (!normalizeLibraryItemTrackBpms(item)) continue;
        item.updatedAt = now;
        updateLib.run(JSON.stringify(item), now, row.id);
      }

      const setRows = db.prepare('SELECT id, setlist_json FROM setlists').all();
      const updateSet = db.prepare(
        'UPDATE setlists SET setlist_json = ?, updated_at = ? WHERE id = ?',
      );
      for (const row of setRows) {
        let doc;
        try {
          doc = JSON.parse(row.setlist_json);
        } catch {
          continue;
        }
        if (!normalizeSetlistTrackBpms(doc)) continue;
        doc.updatedAt = now;
        updateSet.run(JSON.stringify(doc), now, row.id);
      }

      db.prepare('INSERT INTO schema_migrations (version) VALUES (4)').run();
    });
    tx();
  }
}
