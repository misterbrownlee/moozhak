/**
 * Web API integration tests (supertest). Uses MOOZAK_DATA_DIR tmp; mocks GetSongBPM boundary only.
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
import { withMoozhakCredentials } from './testCredentials.js';

/** @type {string} */
let tmpDir;
/** @type {import('express').Express} */
let app;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'moozhak-api-'));
  process.env.MOOZAK_DATA_DIR = tmpDir;

  await jest.unstable_mockModule('../../core/services/getsongbpm.js', () => ({
    isConfigured: jest.fn(() => true),
    lookupAlbumBpm: jest.fn(async () => ({
      success: true,
      tracks: [
        {
          position: 'A1',
          title: 'Track One',
          found: true,
          bpm: 120,
          key: 'Am',
          timeSignature: '4/4',
          openKey: '8m',
        },
      ],
      summary: { total: 1, found: 1, notFound: 0, rateLimited: 0 },
    })),
    findBpm: jest.fn(async () => ({ found: false })),
  }));

  const { createApp } = await import('../../web/app.js');
  app = createApp();
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

describe('GET /api/library', () => {
  it('returns { items: [] } when empty', async () => {
    const res = await request(app).get('/api/library').expect(200);
    expect(res.body).toEqual({ items: [] });
  });
});

describe('POST /api/library', () => {
  it('returns 400 when discogsId or title missing', async () => {
    const res = await request(app)
      .post('/api/library')
      .send({ title: 'Only title' })
      .expect(400);
    expect(res.body.error).toBeDefined();
  });

  it('creates a single item', async () => {
    const res = await request(app)
      .post('/api/library')
      .send({
        discogsId: 42,
        title: 'Test Album',
        artist: 'Artist',
        tracklist: [{ position: 'A1', title: 'Track One' }],
      })
      .expect(201);

    expect(res.body.id).toMatch(/^lib_/);
    expect(res.body.title).toBe('Test Album');
    expect(res.body.sides?.length).toBeGreaterThan(0);
  });

  it('creates multiple items for box set format', async () => {
    const res = await request(app)
      .post('/api/library')
      .send({
        discogsId: 99,
        title: 'Big Box',
        artist: 'Band',
        format: 'Vinyl Box Set',
        tracklist: [
          { type_: 'heading', title: 'Album One' },
          { type_: 'track', position: 'A1', title: 'S1' },
        ],
      })
      .expect(201);

    expect(res.body.boxSet).toBe(true);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});

describe('Library CRUD follow-up', () => {
  it('PUT updates item and DELETE removes', async () => {
    const create = await request(app)
      .post('/api/library')
      .send({
        discogsId: 7,
        title: 'To Edit',
        artist: 'A',
        tracklist: [],
      })
      .expect(201);

    const id = create.body.id;

    const putRes = await request(app)
      .put(`/api/library/${id}`)
      .send({ notes: 'hello' })
      .expect(200);
    expect(putRes.body.notes).toBe('hello');

    await request(app).delete(`/api/library/${id}`).expect(200);
    await request(app).get(`/api/library/${id}`).expect(404);
  });
});

describe('GET /api/collection', () => {
  it('returns empty state when no collection cached', async () => {
    const res = await request(app).get('/api/collection').expect(200);
    expect(res.body.releases).toEqual([]);
    expect(res.body.metadata).toBeNull();
    expect(res.body.message).toBeDefined();
  });
});

describe('POST /api/library/:id/bpm', () => {
  it('merges BPM into sides when API is mocked', async () => {
    const create = await request(app)
      .post('/api/library')
      .send({
        discogsId: 500,
        title: 'Bpm Album',
        artist: 'Singer',
        tracklist: [{ position: 'A1', title: 'Track One' }],
      })
      .expect(201);

    const id = create.body.id;
    const res = await withMoozhakCredentials(
      request(app).post(`/api/library/${id}/bpm`),
    ).expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.item.sides[0].tracks[0].bpm).toBe(120);
    expect(res.body.item.bpmLookupAt).toBeDefined();
  });
});

describe('Export and import', () => {
  it('GET /api/library/export matches envelope', async () => {
    await request(app)
      .post('/api/library')
      .send({ discogsId: 1, title: 'E1', tracklist: [] })
      .expect(201);

    const res = await request(app).get('/api/library/export').expect(200);
    expect(res.body.version).toBe(1);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(1);
    expect(res.body.updatedAt).toBeDefined();
  });

  it('POST /api/library/import replaces items', async () => {
    await request(app)
      .post('/api/library')
      .send({ discogsId: 1, title: 'Old', tracklist: [] })
      .expect(201);

    await request(app)
      .post('/api/library/import')
      .send({
        items: [
          {
            id: 'manual_1',
            discogsId: 2,
            title: 'Imported',
            artist: 'A',
            sides: [],
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      })
      .expect(200);

    const res = await request(app).get('/api/library').expect(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].title).toBe('Imported');
  });

  it('GET /api/collection/export 404 then import works', async () => {
    await request(app).get('/api/collection/export').expect(404);

    const payload = {
      version: 1,
      username: 'tester',
      syncedAt: new Date().toISOString(),
      pagination: { items: 0, pages: 1 },
      releases: [],
    };

    await request(app).post('/api/collection/import').send(payload).expect(200);

    const exported = await request(app)
      .get('/api/collection/export')
      .expect(200);
    expect(exported.body.username).toBe('tester');
  });
});

describe('GET /api/settings and PUT /api/settings', () => {
  it('GET returns shape with unset secrets', async () => {
    const res = await request(app).get('/api/settings').expect(200);
    expect(res.body).toEqual({
      discogsUsername: '',
      discogsTokenSet: false,
      getSongBpmKeySet: false,
    });
  });

  it('PUT persists username and secret flags without echoing secrets', async () => {
    await request(app)
      .put('/api/settings')
      .send({
        discogsUsername: 'myuser',
        discogsToken: 'secret-token',
        getBpmApiKey: 'secret-bpm',
      })
      .expect(200);

    const res = await request(app).get('/api/settings').expect(200);
    expect(res.body.discogsUsername).toBe('myuser');
    expect(res.body.discogsTokenSet).toBe(true);
    expect(res.body.getSongBpmKeySet).toBe(true);
    expect(res.body.discogsToken).toBeUndefined();
    expect(res.body.getBpmApiKey).toBeUndefined();
  });
});
