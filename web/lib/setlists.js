import { getDb } from './persistence/sqlite/db.js';

function rowToSetlist(row) {
  try {
    return JSON.parse(row.setlist_json);
  } catch {
    return null;
  }
}

export function generateSetlistId() {
  return `set_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * @returns {object[]}
 */
export function loadSetlists() {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT setlist_json FROM setlists ORDER BY updated_at DESC, rowid DESC',
    )
    .all();
  return rows.map(rowToSetlist).filter(Boolean);
}

/**
 * @param {string} id
 * @returns {object|null}
 */
export function getSetlist(id) {
  const db = getDb();
  const row = db
    .prepare('SELECT setlist_json FROM setlists WHERE id = ?')
    .get(id);
  if (!row) return null;
  return rowToSetlist(row);
}

/**
 * @param {object} setlist full document (must include id)
 */
export function addSetlist(setlist) {
  const db = getDb();
  const now = new Date().toISOString();
  const doc = {
    ...setlist,
    createdAt: setlist.createdAt || now,
    updatedAt: now,
  };
  const json = JSON.stringify(doc);
  db.prepare(
    `INSERT INTO setlists (id, setlist_json, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
  ).run(doc.id, json, doc.createdAt, doc.updatedAt);
  return doc;
}

/**
 * @param {string} id
 * @param {object} setlist full document
 */
export function updateSetlist(id, setlist) {
  const db = getDb();
  const row = db
    .prepare('SELECT setlist_json FROM setlists WHERE id = ?')
    .get(id);
  if (!row) return null;
  const now = new Date().toISOString();
  const prev = rowToSetlist(row) || {};
  const doc = {
    ...prev,
    ...setlist,
    id,
    createdAt: prev.createdAt || setlist.createdAt || now,
    updatedAt: now,
  };
  const json = JSON.stringify(doc);
  db.prepare(
    `UPDATE setlists SET setlist_json = ?, updated_at = ? WHERE id = ?`,
  ).run(json, doc.updatedAt, id);
  return doc;
}

/**
 * @param {string} id
 * @returns {boolean}
 */
export function removeSetlist(id) {
  const db = getDb();
  const r = db.prepare('DELETE FROM setlists WHERE id = ?').run(id);
  return r.changes > 0;
}
