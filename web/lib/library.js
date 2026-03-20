import { getDb } from './persistence/sqlite/db.js';

// ============================================
// Pure Functions (business logic)
// ============================================

/**
 * Generate unique ID for library items
 */
export function generateId() {
  return `lib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse library file contents (legacy JSON file body)
 */
export function parseLibraryData(content) {
  if (!content) return [];

  try {
    const data = JSON.parse(content);
    return data.items || [];
  } catch (error) {
    console.error('Error parsing library data:', error);
    return [];
  }
}

/**
 * Build library file structure (export / legacy envelope)
 */
export function buildLibraryData(items) {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    items,
  };
}

/**
 * Create a new library item with metadata
 */
export function createLibraryItem(item) {
  return {
    id: generateId(),
    ...item,
    addedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Apply updates to an item (pure)
 */
export function applyItemUpdates(item, updates) {
  const { id: _id, addedAt: _addedAt, ...safeUpdates } = updates;
  return {
    ...item,
    ...safeUpdates,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Find item by ID in items array
 */
export function findItemById(items, id) {
  return items.find((item) => item.id === id) || null;
}

/**
 * Find item by Discogs ID in items array
 */
export function findItemByDiscogsId(items, discogsId) {
  return (
    items.find((item) => String(item.discogsId) === String(discogsId)) || null
  );
}

// ============================================
// SQLite persistence
// ============================================

function rowToItem(row) {
  try {
    return JSON.parse(row.item_json);
  } catch {
    return null;
  }
}

/**
 * Load library items in stable order (insertion order).
 * @returns {object[]}
 */
export function loadLibrary() {
  const db = getDb();
  const rows = db
    .prepare('SELECT item_json FROM library_items ORDER BY rowid ASC')
    .all();
  return rows.map(rowToItem).filter(Boolean);
}

/**
 * Replace all library items (used for import). Runs in a transaction.
 * @param {object[]} items
 */
export function replaceLibraryItems(items) {
  const db = getDb();
  const del = db.prepare('DELETE FROM library_items');
  const ins = db.prepare(
    `INSERT INTO library_items (id, discogs_id, item_json, added_at, updated_at)
     VALUES (@id, @discogs_id, @item_json, @added_at, @updated_at)`,
  );
  const tx = db.transaction((list) => {
    del.run();
    for (const raw of list) {
      const now = new Date().toISOString();
      const item = raw.id
        ? raw
        : {
            ...raw,
            id: generateId(),
            addedAt: raw.addedAt ?? now,
            updatedAt: raw.updatedAt ?? now,
          };
      const discogsId =
        item.discogsId !== undefined && item.discogsId !== null
          ? String(item.discogsId)
          : null;
      ins.run({
        id: item.id,
        discogs_id: discogsId,
        item_json: JSON.stringify(item),
        added_at: item.addedAt ?? null,
        updated_at: item.updatedAt ?? null,
      });
    }
  });
  tx(items);
}

/**
 * Legacy no-op for callers that saved the whole array; SQLite persists per row.
 * @param {object[]} items
 */
export function saveLibrary(items) {
  replaceLibraryItems(items);
}

/**
 * Add item to library
 */
export function addToLibrary(item) {
  const db = getDb();
  const newItem = createLibraryItem(item);
  const discogsId =
    newItem.discogsId !== undefined && newItem.discogsId !== null
      ? String(newItem.discogsId)
      : null;
  db.prepare(
    `INSERT INTO library_items (id, discogs_id, item_json, added_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    newItem.id,
    discogsId,
    JSON.stringify(newItem),
    newItem.addedAt,
    newItem.updatedAt,
  );
  return newItem;
}

/**
 * Update library item
 */
export function updateLibraryItem(id, updates) {
  const db = getDb();
  const row = db
    .prepare('SELECT item_json FROM library_items WHERE id = ?')
    .get(id);
  if (!row) return null;

  const item = rowToItem(row);
  if (!item) return null;

  const next = applyItemUpdates(item, updates);
  const discogsId =
    next.discogsId !== undefined && next.discogsId !== null
      ? String(next.discogsId)
      : null;
  db.prepare(
    `UPDATE library_items SET item_json = ?, updated_at = ?, discogs_id = ? WHERE id = ?`,
  ).run(JSON.stringify(next), next.updatedAt, discogsId, id);
  return next;
}

/**
 * Remove item from library
 */
export function removeFromLibrary(id) {
  const db = getDb();
  const result = db.prepare('DELETE FROM library_items WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Get single library item by ID
 */
export function getLibraryItem(id) {
  const db = getDb();
  const row = db
    .prepare('SELECT item_json FROM library_items WHERE id = ?')
    .get(id);
  if (!row) return null;
  return rowToItem(row);
}

/**
 * Find item by Discogs ID
 */
export function findByDiscogsId(discogsId) {
  const db = getDb();
  const sid = String(discogsId);
  const row = db
    .prepare('SELECT item_json FROM library_items WHERE discogs_id = ?')
    .get(sid);
  if (row) return rowToItem(row);
  const rows = db.prepare('SELECT item_json FROM library_items').all();
  for (const r of rows) {
    const item = rowToItem(r);
    if (item && String(item.discogsId) === sid) return item;
  }
  return null;
}
