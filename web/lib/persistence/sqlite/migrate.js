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
}
