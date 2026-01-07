import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ansis from 'ansis';
import { projectRoot } from './config.js';

// Initialize logging for this CLI session
const sessionTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logDir = join(projectRoot, 'dist', 'logs');
const logFile = join(logDir, `log-${sessionTimestamp}.txt`);

/**
 * Styled console loggers using ansis
 */
export const log = {
  /** Green success/general messages */
  success: (...args) => console.log(ansis.green(' ->'), ...args),

  /** Green success/general messages */
  say: (...args) => console.log(ansis.white(), ...args),

  /** Red error messages */
  error: (...args) =>
    console.error(ansis.red(' !!'), ansis.red(...args.map(String))),

  /** Yellow warning messages */
  warn: (...args) =>
    console.warn(ansis.yellow(' !!'), ansis.yellow(...args.map(String))),

  /** Dim debug/verbose messages */
  debug: (...args) =>
    console.log(ansis.dim(' '), ansis.dim(...args.map(String))),

  /** Blue informational messages */
  info: (...args) => console.log(ansis.blue(' ::'), ...args),

  /** Plain message (no prefix) */
  plain: (...args) => console.log(...args),

  /** Styled header */
  header: (text) => console.log(ansis.bold.cyan(text)),

  /** Styled dim text (for secondary info) */
  dim: (...args) => console.log(ansis.dim(...args.map(String))),

  divider: (addPadding = false) => {
    const pad = addPadding ? `\n` : '';
    console.log(
      ansis.fg(
        2,
      )`${pad}=====================================================${pad}`,
    );
  },
};

/**
 * Initialize log file for the session
 */
export function initLog() {
  mkdirSync(logDir, { recursive: true });
  const header = `=== Muzak CLI Log ===\nSession: ${sessionTimestamp}\nStarted: ${new Date().toISOString()}\n\n`;
  writeFileSync(logFile, header);
}

/**
 * Write an entry to the log file
 * @param {string} entry - Log entry text
 */
export function writeLog(entry) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${entry}\n`;
  const content = existsSync(logFile) ? readFileSync(logFile, 'utf-8') : '';
  writeFileSync(logFile, content + logEntry);
}

/**
 * Log raw API response
 * @param {string} endpoint - API endpoint called
 * @param {Object} params - Request parameters
 * @param {Object} response - API response data
 */
export function logApiResponse(endpoint, params, response) {
  const separator = '─'.repeat(60);
  const entry = `
${separator}
API CALL: ${endpoint}
PARAMS: ${JSON.stringify(params, null, 2)}
RESPONSE:
${JSON.stringify(response, null, 2)}
${separator}
`;
  writeLog(entry);
}

export { sessionTimestamp, logDir };
