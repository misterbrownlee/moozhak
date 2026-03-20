/**
 * App settings + request credential resolution (tmp MOOZAK_DATA_DIR).
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from '@jest/globals';

let tmpDir;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'moozhak-appsettings-'));
  process.env.MOOZAK_DATA_DIR = tmpDir;
});

afterEach(async () => {
  const { clearAllPersistenceTables } = await import(
    '../../web/lib/persistence/sqlite/db.js'
  );
  clearAllPersistenceTables();
});

afterAll(async () => {
  const { closeDb } = await import('../../web/lib/persistence/sqlite/db.js');
  closeDb();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.MOOZAK_DATA_DIR;
});

describe('appSettings', () => {
  it('header overrides DB for Discogs token', async () => {
    const { setAppSettings, APP_SETTING_KEYS, resolveDiscogsTokenFromRequest } =
      await import('../../web/lib/appSettings.js');

    setAppSettings({ [APP_SETTING_KEYS.DISCOGS_TOKEN]: 'from-db' });

    const req = {
      headers: { 'x-moozhak-discogs-token': 'from-header' },
    };
    expect(resolveDiscogsTokenFromRequest(req)).toBe('from-header');
  });

  it('falls back to DB when header absent', async () => {
    const { setAppSettings, APP_SETTING_KEYS, resolveDiscogsTokenFromRequest } =
      await import('../../web/lib/appSettings.js');

    setAppSettings({ [APP_SETTING_KEYS.DISCOGS_TOKEN]: 'stored' });

    const req = { headers: {} };
    expect(resolveDiscogsTokenFromRequest(req)).toBe('stored');
  });
});
