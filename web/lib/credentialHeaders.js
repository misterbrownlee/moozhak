/**
 * HTTP header names for per-request API credentials (lowercase; Express normalizes incoming headers).
 * Documented in web/README.md
 */
export const MOOZAK_CREDENTIAL_HEADERS = {
  DISCOGS_TOKEN: 'x-moozhak-discogs-token',
  GETSONGBPM_KEY: 'x-moozhak-getsongbpm-key',
  DISCOGS_USERNAME: 'x-moozhak-discogs-username',
};

/** @param {import('express').Request} req */
function headerString(req, name) {
  const raw = req.headers[name];
  if (raw === undefined || raw === null) return null;
  const s = Array.isArray(raw) ? raw[0] : raw;
  const t = String(s).trim();
  return t || null;
}

/**
 * @param {import('express').Request} req
 * @param {string} headerName
 * @param {() => string | null} getFromDb
 * @returns {string | null}
 */
export function resolveCredential(req, headerName, getFromDb) {
  const fromHeader = headerString(req, headerName);
  if (fromHeader) return fromHeader;
  return getFromDb();
}
