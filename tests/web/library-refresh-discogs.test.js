/**
 * POST /api/library/:id/refresh-discogs with mocked Discogs getRelease.
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
  jest,
} from '@jest/globals';
import request from 'supertest';

/** @type {string} */
let tmpDir;
/** @type {import('express').Express} */
let app;
/** @type {jest.Mock} */
let getReleaseMock;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'mzk-refresh-'));
  process.env.MOOZAK_DATA_DIR = tmpDir;

  getReleaseMock = jest.fn(async () => ({
    id: 42,
    title: 'Refreshed Title',
    year: 2005,
    formats: [{ name: 'Vinyl' }],
    images: [{ uri: 'http://cover', uri150: 'http://thumb' }],
    thumb: 'http://thumb',
    tracklist: [
      {
        type_: 'track',
        position: 'A1',
        title: 'Track One',
        duration: '3:00',
        artists: [{ name: 'Guest' }],
      },
    ],
  }));

  await jest.unstable_mockModule('../../core/services/discogs.js', () => ({
    getDiscogsRateLimitStatus: jest.fn(() => ({})),
    buildDiscogsUrl: jest.fn(() => ''),
    buildDiscogsUrlFromUri: jest.fn(() => ''),
    createClient: jest.fn(() => ({
      db: {},
      user: {},
      token: null,
      isAuthenticated: false,
    })),
    getIdentity: jest.fn(async () => null),
    getCollection: jest.fn(async () => null),
    searchDiscogs: jest.fn(async () => []),
    formatResult: jest.fn(() => ''),
    getMaster: jest.fn(async () => null),
    getRelease: getReleaseMock,
    formatTrack: jest.fn(() => ''),
  }));

  const { createApp } = await import('../../web/app.js');
  app = createApp();
});

afterEach(async () => {
  const { clearAllPersistenceTables } = await import(
    '../../web/lib/persistence/sqlite/db.js',
  );
  clearAllPersistenceTables();
  getReleaseMock.mockClear();
});

afterAll(async () => {
  const { closeDb } = await import('../../web/lib/persistence/sqlite/db.js');
  closeDb();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.MOOZAK_DATA_DIR;
});

describe('POST /api/library/:id/refresh-discogs', () => {
  it('merges release data and preserves BPM fields', async () => {
    const create = await request(app)
      .post('/api/library')
      .send({
        discogsId: 42,
        title: 'Old',
        artist: 'Various',
        tracklist: [
          {
            position: 'A1',
            title: 'Track One',
            bpm: 118,
            key: 'Cm',
            timeSignature: '4/4',
            openKey: '5m',
          },
        ],
      })
      .expect(201);

    const id = create.body.id;

    const res = await request(app)
      .post(`/api/library/${id}/refresh-discogs`)
      .expect(200);

    expect(res.body.item.title).toBe('Refreshed Title');
    expect(res.body.item.artist).toBe('Various');
    const tr = res.body.item.sides[0].tracks[0];
    expect(tr.trackArtist).toBe('Guest');
    expect(tr.bpm).toBe(118);
    expect(tr.key).toBe('Cm');
    expect(tr.timeSignature).toBe('4/4');
    expect(tr.openKey).toBe('5m');
    expect(getReleaseMock).toHaveBeenCalled();
  });

  it('returns 404 for missing item', async () => {
    await request(app)
      .post('/api/library/lib_missing/refresh-discogs')
      .expect(404);
  });
});
