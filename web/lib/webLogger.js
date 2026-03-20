import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
const logDir = join(projectRoot, '.logs');
const webLogFile = join(logDir, 'web.log');

/**
 * Ensure log directory exists
 */
function ensureLogDir() {
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
}

/**
 * Format timestamp for log entries
 */
function timestamp() {
  return new Date().toISOString();
}

/**
 * Write a log entry to the web log file
 * @param {string} level - Log level (INFO, DEBUG, ERROR, etc.)
 * @param {string} category - Category (REQUEST, RESPONSE, ACTION, etc.)
 * @param {string} message - Log message
 * @param {Object} [data] - Optional data to include
 */
export function writeWebLog(level, category, message, data = null) {
  ensureLogDir();

  const entry = {
    timestamp: timestamp(),
    level,
    category,
    message,
    ...(data && { data }),
  };

  const logLine = `${JSON.stringify(entry)}\n`;

  try {
    appendFileSync(webLogFile, logLine);
  } catch (error) {
    console.error('Failed to write web log:', error.message);
  }
}

/**
 * Log an HTTP request
 * @param {Object} req - Express request object
 */
export function logRequest(req) {
  const data = {
    method: req.method,
    url: req.originalUrl,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    body: req.body && Object.keys(req.body).length > 0 ? req.body : undefined,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  };

  // Remove undefined values
  for (const key of Object.keys(data)) {
    if (data[key] === undefined) delete data[key];
  }

  writeWebLog('DEBUG', 'REQUEST', `${req.method} ${req.originalUrl}`, data);
}

/**
 * Log an HTTP response
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} body - Response body
 * @param {number} duration - Request duration in ms
 */
export function logResponse(req, res, body, duration) {
  const data = {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    body: summarizeResponseBody(body),
  };

  const level = res.statusCode >= 400 ? 'ERROR' : 'DEBUG';
  writeWebLog(
    level,
    'RESPONSE',
    `${req.method} ${req.originalUrl} ${res.statusCode}`,
    data,
  );
}

/**
 * Summarize response body for logging (truncate large payloads)
 * @param {*} body - Response body
 * @returns {*} Summarized body
 */
function summarizeResponseBody(body) {
  if (!body) return undefined;

  // If it's a string, truncate if too long
  if (typeof body === 'string') {
    return body.length > 500 ? `${body.substring(0, 500)}...[truncated]` : body;
  }

  // If it's an object, summarize arrays
  if (typeof body === 'object') {
    const summary = { ...body };

    // Summarize arrays (just show count)
    for (const key of Object.keys(summary)) {
      if (Array.isArray(summary[key])) {
        summary[key] = `[Array: ${summary[key].length} items]`;
      }
    }

    return summary;
  }

  return body;
}

/**
 * Log a user action from the client
 * @param {string} action - Action name
 * @param {Object} [details] - Action details
 */
export function logUserAction(action, details = null) {
  writeWebLog('INFO', 'ACTION', action, details);
}

/**
 * Express middleware for request/response logging
 */
export function requestLogger() {
  return (req, res, next) => {
    const startTime = Date.now();

    // Log the request
    logRequest(req);

    // Capture the response body
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const duration = Date.now() - startTime;
      logResponse(req, res, body, duration);
      return originalJson(body);
    };

    // For non-JSON responses (rendered pages)
    const originalRender = res.render.bind(res);
    res.render = (view, options, callback) => {
      const duration = Date.now() - startTime;
      writeWebLog(
        'DEBUG',
        'RESPONSE',
        `${req.method} ${req.originalUrl} RENDER:${view}`,
        {
          method: req.method,
          url: req.originalUrl,
          view,
          duration: `${duration}ms`,
        },
      );
      return originalRender(view, options, callback);
    };

    next();
  };
}

export { logDir, webLogFile };
