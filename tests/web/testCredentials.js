import { MOOZAK_CREDENTIAL_HEADERS } from '../../web/lib/credentialHeaders.js';

/**
 * Attach documented Moozhak credential headers (for supertest).
 * Use dummy values when Discogs/GetSongBPM are mocked.
 * @param {import('supertest').Test} req
 */
export function withMoozhakCredentials(req) {
  return req
    .set(MOOZAK_CREDENTIAL_HEADERS.DISCOGS_TOKEN, 'test-discogs-token')
    .set(MOOZAK_CREDENTIAL_HEADERS.DISCOGS_USERNAME, 'test-discogs-user')
    .set(MOOZAK_CREDENTIAL_HEADERS.GETSONGBPM_KEY, 'test-getsongbpm-key');
}
