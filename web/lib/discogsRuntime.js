import { createClient } from '../../core/services/discogs.js';
import {
  resolveDiscogsTokenFromDb,
  resolveDiscogsTokenFromRequest,
} from './appSettings.js';

/**
 * Discogs context for JSON API routes (header overrides DB).
 * @param {import('express').Request} req
 */
export function getDiscogsContext(req) {
  const token = resolveDiscogsTokenFromRequest(req);
  return createClient(token);
}

/**
 * Discogs context for SSR (DB defaults only; no request headers).
 */
export function getDiscogsContextForSsr() {
  const token = resolveDiscogsTokenFromDb();
  return createClient(token);
}
