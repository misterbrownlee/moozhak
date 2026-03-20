import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDataDir } from '../../dataRoot.js';

/**
 * If DB has no library rows but legacy library.json exists, import items.
 * If collection_cache empty but collection.json exists, import payload.
 * Idempotent: skips when rows already present.
 * @param {import('better-sqlite3').Database} db
 */
export function importLegacyJsonIfNeeded(db) {
  const libCount = db
    .prepare('SELECT COUNT(*) AS c FROM library_items')
    .get().c;
  if (libCount === 0) {
    const path = join(getDataDir(), 'library.json');
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, 'utf-8');
        const data = JSON.parse(raw);
        const items = data.items || [];
        const insert = db.prepare(
          `INSERT INTO library_items (id, discogs_id, item_json, added_at, updated_at)
           VALUES (@id, @discogs_id, @item_json, @added_at, @updated_at)`,
        );
        const insertMany = db.transaction((rows) => {
          for (const item of rows) {
            const discogsId =
              item.discogsId !== undefined && item.discogsId !== null
                ? String(item.discogsId)
                : null;
            insert.run({
              id: item.id,
              discogs_id: discogsId,
              item_json: JSON.stringify(item),
              added_at: item.addedAt ?? null,
              updated_at: item.updatedAt ?? null,
            });
          }
        });
        insertMany(items);
      } catch (e) {
        console.error('Legacy library.json import failed:', e);
      }
    }
  }

  const collRow = db
    .prepare('SELECT COUNT(*) AS c FROM collection_cache')
    .get().c;
  if (collRow === 0) {
    const path = join(getDataDir(), 'collection.json');
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, 'utf-8');
        const parsed = JSON.parse(raw);
        db.prepare(
          'INSERT INTO collection_cache (singleton, payload_json) VALUES (1, ?)',
        ).run(JSON.stringify(parsed));
      } catch (e) {
        console.error('Legacy collection.json import failed:', e);
      }
    }
  }
}
