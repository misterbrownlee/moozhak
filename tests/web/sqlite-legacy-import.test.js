/**
 * Ensures legacy library.json / collection.json in MOOZAK_DATA_DIR are imported on first DB open.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

/** @type {string} */
let tmpDir;
/** @type {import('express').Express} */
let app;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'moozhak-legacy-'));
  process.env.MOOZAK_DATA_DIR = tmpDir;

  const libraryFixture = {
    version: 1,
    updatedAt: '2020-01-01T00:00:00.000Z',
    items: [
      {
        id: 'lib_legacy_1',
        discogsId: 1001,
        title: 'From JSON',
        artist: 'Artist',
        type: 'release',
        year: '',
        format: '',
        thumb: '',
        cover: '',
        sides: [],
        notes: '',
        addedAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-01T00:00:00.000Z',
      },
    ],
  };

  const collectionFixture = {
    version: 1,
    username: 'legacy_user',
    syncedAt: '2020-01-01T00:00:00.000Z',
    pagination: { items: 0, pages: 1 },
    releases: [],
  };

  writeFileSync(join(tmpDir, 'library.json'), JSON.stringify(libraryFixture));
  writeFileSync(
    join(tmpDir, 'collection.json'),
    JSON.stringify(collectionFixture),
  );

  const { createApp } = await import('../../web/app.js');
  app = createApp();
});

afterAll(async () => {
  const { closeDb } = await import('../../web/lib/persistence/sqlite/db.js');
  closeDb();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.MOOZAK_DATA_DIR;
});

describe('Legacy JSON import on first open', () => {
  it('loads library item from library.json', async () => {
    const res = await request(app).get('/api/library').expect(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].id).toBe('lib_legacy_1');
    expect(res.body.items[0].title).toBe('From JSON');
  });

  it('loads collection metadata from collection.json', async () => {
    const res = await request(app).get('/api/collection').expect(200);
    expect(res.body.metadata?.username).toBe('legacy_user');
  });
});
