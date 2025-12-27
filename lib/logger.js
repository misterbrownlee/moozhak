import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { projectRoot } from './config.js';

// Initialize logging for this CLI session
const sessionTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logDir = join(projectRoot, 'dist', 'logs');
let logFile = join(logDir, `log-${sessionTimestamp}.txt`);

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

