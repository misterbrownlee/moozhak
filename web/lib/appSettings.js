import {
  MOOZAK_CREDENTIAL_HEADERS,
  resolveCredential,
} from './credentialHeaders.js';
import { getDb } from './persistence/sqlite/db.js';

export const APP_SETTING_KEYS = {
  DISCOGS_TOKEN: 'DISCOGS_TOKEN',
  DISCOGS_USERNAME: 'DISCOGS_USERNAME',
  GETBPM_API_KEY: 'GETBPM_API_KEY',
};

/**
 * @param {string} key
 * @returns {string | null} trimmed non-empty value, or null
 */
export function getAppSetting(key) {
  const row = getDb()
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .get(key);
  if (!row?.value) return null;
  const t = String(row.value).trim();
  return t || null;
}

/**
 * @param {Record<string, string | undefined | null>} partial
 */
export function setAppSettings(partial) {
  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO app_settings (key, value) VALUES (@key, @value)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  for (const [key, value] of Object.entries(partial)) {
    if (value === undefined) continue;
    const normalized = value === null || value === '' ? '' : String(value);
    upsert.run({ key, value: normalized });
  }
}

/**
 * @returns {Record<string, string>}
 */
export function getPublicSettingsShape() {
  const token = getAppSetting(APP_SETTING_KEYS.DISCOGS_TOKEN);
  const username = getAppSetting(APP_SETTING_KEYS.DISCOGS_USERNAME);
  const bpm = getAppSetting(APP_SETTING_KEYS.GETBPM_API_KEY);
  return {
    discogsUsername: username ?? '',
    discogsTokenSet: Boolean(token),
    getSongBpmKeySet: Boolean(bpm),
  };
}

// --- DB-only (SSR, warning banners) ---

export function resolveDiscogsTokenFromDb() {
  return getAppSetting(APP_SETTING_KEYS.DISCOGS_TOKEN);
}

export function resolveDiscogsUsernameFromDb() {
  return getAppSetting(APP_SETTING_KEYS.DISCOGS_USERNAME);
}

export function resolveGetBpmApiKeyFromDb() {
  return getAppSetting(APP_SETTING_KEYS.GETBPM_API_KEY);
}

/** @param {import('express').Request} req */
export function resolveDiscogsTokenFromRequest(req) {
  return resolveCredential(req, MOOZAK_CREDENTIAL_HEADERS.DISCOGS_TOKEN, () =>
    getAppSetting(APP_SETTING_KEYS.DISCOGS_TOKEN),
  );
}

/** @param {import('express').Request} req */
export function resolveDiscogsUsernameFromRequest(req) {
  return resolveCredential(
    req,
    MOOZAK_CREDENTIAL_HEADERS.DISCOGS_USERNAME,
    () => getAppSetting(APP_SETTING_KEYS.DISCOGS_USERNAME),
  );
}

/** @param {import('express').Request} req */
export function resolveGetSongBpmApiKeyFromRequest(req) {
  return resolveCredential(req, MOOZAK_CREDENTIAL_HEADERS.GETSONGBPM_KEY, () =>
    getAppSetting(APP_SETTING_KEYS.GETBPM_API_KEY),
  );
}

/**
 * For SSR / library warnings: Discogs is "configured" only if both token and username exist in DB.
 * @returns {{ discogsTokenSet: boolean, discogsUsernameSet: boolean, showDiscogsWarning: boolean }}
 */
export function discogsSetupStatusFromDb() {
  const token = resolveDiscogsTokenFromDb();
  const username = resolveDiscogsUsernameFromDb();
  const discogsTokenSet = Boolean(token);
  const discogsUsernameSet = Boolean(username);
  return {
    discogsTokenSet,
    discogsUsernameSet,
    showDiscogsWarning: !discogsTokenSet || !discogsUsernameSet,
  };
}
