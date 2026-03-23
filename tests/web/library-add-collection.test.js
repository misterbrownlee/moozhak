/**
 * POST /api/library resolves master → collection release when cache matches.
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
  tmpDir = mkdtempSync(join(tmpdir(), 'mzk-add-coll-'));
  process.env.MOOZAK_DATA_DIR = tmpDir;

  getReleaseMock = jest.fn(async () => ({
    id: 888,
    master_id: 100,
    title: 'Collection Pressing',
    year: 1971,
    artists: [{ name: 'Band' }],
    formats: [{ name: 'Vinyl, LP' }],
    images: [{ uri: 'http://cover', uri150: 'http://thumb' }],
    thumb: 'http://thumb',
    tracklist: [{ type_: 'track', position: 'A1', title: 'One' }],
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

describe('POST /api/library master + collection cache', () => {
  it('fetches collection release and sets addedFromCollection', async () => {
    const { replaceCollectionPayload } = await import(
      '../../web/lib/collection.js',
    );
    replaceCollectionPayload({
      version: 1,
      username: 'tester',
      syncedAt: new Date().toISOString(),
      pagination: { items: 1, pages: 1 },
      releases: [
        {
          instance_id: 1,
          date_added: '2024-06-15T12:00:00',
          basic_information: {
            id: 888,
            master_id: 100,
            title: 'Album',
            year: 1971,
            thumb: '',
            cover_image: '',
            artists: [{ name: 'Band' }],
            formats: [{ name: 'Vinyl' }],
          },
        },
      ],
    });

    const res = await request(app)
      .post('/api/library')
      .send({
        discogsId: 100,
        type: 'master',
        title: 'Placeholder',
        artist: 'Band',
        tracklist: [],
      })
      .expect(201);

    expect(res.body.type).toBe('release');
    expect(res.body.discogsId).toBe(888);
    expect(res.body.masterDiscogsId).toBe(100);
    expect(res.body.addedFromCollection).toBe(true);
    expect(res.body.title).toBe('Collection Pressing');
    expect(getReleaseMock).toHaveBeenCalledWith(
      {},
      888,
      expect.objectContaining({ isAuthenticated: false }),
    );
  });

  it('leaves master body when collection has no match', async () => {
    const res = await request(app)
      .post('/api/library')
      .send({
        discogsId: 99999,
        type: 'master',
        title: 'Solo Master',
        artist: 'Artist',
        tracklist: [{ position: 'A1', title: 'T' }],
      })
      .expect(201);

    expect(res.body.type).toBe('master');
    expect(res.body.discogsId).toBe(99999);
    expect(res.body.addedFromCollection).toBeUndefined();
    expect(getReleaseMock).not.toHaveBeenCalled();
  });
});
