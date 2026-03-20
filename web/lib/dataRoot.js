import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMoozhakDataDirFromConfig } from '../../core/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Default data directory (project root `data/`) when no env or config path is set.
 */
const DEFAULT_DATA_DIR = join(__dirname, '../../data');

/**
 * Resolved absolute path for runtime data (library DB, legacy JSON import sources, exports).
 *
 * Precedence:
 * 1. `MOOZAK_DATA_DIR` environment variable (for tests, CI, shells)
 * 2. `MOOZAK_DATA_DIR=` in `.mzkconfig` (relative paths resolved from project root)
 * 3. Default: `data/` under the repo
 *
 * @returns {string}
 */
export function getDataDir() {
  const fromEnv = process.env.MOOZAK_DATA_DIR?.trim();
  const rawDir = fromEnv
    ? join(fromEnv)
    : (getMoozhakDataDirFromConfig() ?? DEFAULT_DATA_DIR);
  if (!existsSync(rawDir)) {
    mkdirSync(rawDir, { recursive: true });
  }
  return rawDir;
}

/**
 * SQLite file path under the data directory.
 * @returns {string}
 */
export function getSqlitePath() {
  return join(getDataDir(), 'moozhak.db');
}
