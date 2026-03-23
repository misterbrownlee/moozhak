/**
 * Pure helpers for matching Discogs user collection cache to library/search flows.
 */

/**
 * @param {string|undefined} s
 * @returns {number}
 */
function dateAddedSortKey(s) {
  if (!s) return 0;
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * @param {Array<{
 *   discogsId?: unknown,
 *   masterId?: unknown,
 *   dateAdded?: string,
 * }>} releases Normalized collection rows (see normalizeCollectionRelease)
 * @returns {{
 *   releaseIdSet: Set<string>,
 *   masterIdToReleases: Map<string, Array<{ discogsId: string, dateAdded: string }>>,
 * }}
 */
export function buildCollectionIndex(releases) {
  const releaseIdSet = new Set();
  /** @type {Map<string, Array<{ discogsId: string, dateAdded: string }>>} */
  const masterIdToReleases = new Map();

  for (const r of releases || []) {
    const rid = r.discogsId != null ? String(r.discogsId) : '';
    if (rid) releaseIdSet.add(rid);

    const mid = r.masterId != null ? String(r.masterId) : '';
    if (mid && rid) {
      if (!masterIdToReleases.has(mid)) {
        masterIdToReleases.set(mid, []);
      }
      masterIdToReleases.get(mid).push({
        discogsId: rid,
        dateAdded: typeof r.dateAdded === 'string' ? r.dateAdded : '',
      });
    }
  }

  return { releaseIdSet, masterIdToReleases };
}

/**
 * Pick one collection release id for a master (most recently added in cache wins).
 * @param {ReturnType<typeof buildCollectionIndex>} index
 * @param {unknown} masterId
 * @returns {number|null}
 */
export function pickCollectionReleaseForMaster(index, masterId) {
  const mid = String(masterId);
  const list = index.masterIdToReleases.get(mid);
  if (!list || list.length === 0) return null;

  const sorted = [...list].sort(
    (a, b) => dateAddedSortKey(b.dateAdded) - dateAddedSortKey(a.dateAdded),
  );
  const id = sorted[0]?.discogsId;
  if (id == null || id === '') return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {Record<string, unknown>|null|undefined} item Library item
 * @param {ReturnType<typeof buildCollectionIndex>} index
 * @returns {boolean}
 */
export function libraryItemInCollection(item, index) {
  if (!item || !index) return false;
  const type = item.type || 'release';

  if (type === 'release') {
    const id = item.discogsId != null ? String(item.discogsId) : '';
    return Boolean(id && index.releaseIdSet.has(id));
  }

  if (type === 'master') {
    const masterId = item.discogsId != null ? String(item.discogsId) : '';
    if (!masterId) return false;
    const list = index.masterIdToReleases.get(masterId);
    return Boolean(list && list.length > 0);
  }

  return false;
}

/**
 * Master search result id matches this library row (release rows use masterDiscogsId).
 * @param {Record<string, unknown>|null|undefined} item
 * @param {unknown} masterId
 * @returns {boolean}
 */
export function libraryItemMatchesMasterId(item, masterId) {
  if (!item) return false;
  const m = String(masterId);
  if (item.type === 'master' && String(item.discogsId) === m) return true;
  if (
    item.masterDiscogsId != null &&
    String(item.masterDiscogsId) === m
  ) {
    return true;
  }
  return false;
}
