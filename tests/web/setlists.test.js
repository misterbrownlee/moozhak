/**
 * Sets API + library set-usage integration tests.
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
import request from 'supertest';

/** @type {string} */
let tmpDir;
/** @type {import('express').Express} */
let app;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'moozhak-setlists-'));
  process.env.MOOZAK_DATA_DIR = tmpDir;
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

async function seedLibraryAlbum() {
  const body = {
    discogsId: 9001,
    type: 'release',
    title: 'Test LP',
    artist: 'Tester',
    year: '2020',
    format: 'Vinyl',
    thumb: 'http://example.com/t.jpg',
    cover: 'http://example.com/c.jpg',
    tracklist: [
      { position: 'A1', title: 'One', type_: 'track' },
      { position: 'A2', title: 'Two', type_: 'track' },
    ],
  };
  const res = await request(app).post('/api/library').send(body).expect(201);
  return res.body;
}

describe('Sets API', () => {
  it('GET /api/setlists returns empty list', async () => {
    const res = await request(app).get('/api/setlists').expect(200);
    expect(res.body.setlists).toEqual([]);
  });

  it('POST and PUT setlist with tracks', async () => {
    const item = await seedLibraryAlbum();
    const cr = await request(app)
      .post('/api/setlists')
      .send({ name: 'My set', notes: 'hi', tracks: [] })
      .expect(201);
    expect(cr.body.id).toBeDefined();
    expect(cr.body.name).toBe('My set');
    expect(cr.body.stats.trackCount).toBe(0);

    const id = cr.body.id;
    const ur = await request(app)
      .put(`/api/setlists/${id}`)
      .send({
        name: 'My set',
        notes: 'hi',
        tracks: [
          { libraryItemId: item.id, trackPosition: 'A1' },
          { libraryItemId: item.id, trackPosition: 'A2' },
        ],
      })
      .expect(200);
    expect(ur.body.tracks).toHaveLength(2);
    expect(ur.body.tracks[0].title).toBe('One');
    expect(ur.body.stats.trackCount).toBe(2);

    const gr = await request(app).get(`/api/setlists/${id}`).expect(200);
    expect(gr.body.tracks).toHaveLength(2);

    await request(app).delete(`/api/setlists/${id}`).expect(200);
    await request(app).get(`/api/setlists/${id}`).expect(404);
  });

  it('rejects notes over 300 chars', async () => {
    await request(app)
      .post('/api/setlists')
      .send({ name: 'x', notes: 'a'.repeat(301), tracks: [] })
      .expect(400);
  });
});

describe('GET /api/library/:id/set-usage', () => {
  it('returns sets referencing album', async () => {
    const item = await seedLibraryAlbum();
    const cr = await request(app)
      .post('/api/setlists')
      .send({
        name: 'Ref set',
        notes: '',
        tracks: [{ libraryItemId: item.id, trackPosition: 'A1' }],
      })
      .expect(201);
    const sid = cr.body.id;

    const res = await request(app)
      .get(`/api/library/${item.id}/set-usage`)
      .expect(200);
    expect(res.body.sets).toEqual([{ id: sid, name: 'Ref set' }]);
  });

  it('404 when library item missing', async () => {
    await request(app).get('/api/library/nope/set-usage').expect(404);
  });
});
