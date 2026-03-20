/**
 * In-memory rate limiter with sliding window
 *
 * Tracks request timestamps and provides throttling/blocking
 * to stay within API rate limits.
 *
 * Supports multiple named instances for different APIs.
 */

import { log } from '../logger.js';

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  maxRequests: 3000, // Maximum requests per window
  windowMs: 60 * 60 * 1000, // 1 hour in milliseconds
  throttleThreshold: 0.8, // Start throttling at 80% of limit
  minDelayMs: 100, // Minimum delay between requests
  name: 'default', // Name for logging
};

/**
 * Registry of rate limiter instances
 */
const instances = new Map();

/**
 * Create a rate limiter instance
 * @param {Object} config - Configuration options
 * @returns {Object} Rate limiter instance
 */
export function createRateLimiter(config = {}) {
  const state = {
    timestamps: [],
    config: { ...DEFAULT_CONFIG, ...config },
  };

  /**
   * Remove timestamps outside the current window
   */
  function pruneOldTimestamps() {
    const cutoff = Date.now() - state.config.windowMs;
    state.timestamps = state.timestamps.filter((ts) => ts > cutoff);
  }

  /**
   * Get the number of requests in the current window
   * @returns {number} Request count
   */
  function getRequestCount() {
    pruneOldTimestamps();
    return state.timestamps.length;
  }

  /**
   * Get rate limiter status
   * @returns {Object} Status object with count, limit, remaining, etc.
   */
  function getStatus() {
    pruneOldTimestamps();
    const count = state.timestamps.length;
    const { maxRequests, throttleThreshold, name } = state.config;
    const throttleAt = Math.floor(maxRequests * throttleThreshold);

    return {
      name,
      count,
      limit: maxRequests,
      remaining: maxRequests - count,
      isThrottling: count >= throttleAt,
      isBlocked: count >= maxRequests,
      throttleThreshold: throttleAt,
      windowMs: state.config.windowMs,
    };
  }

  /**
   * Calculate the delay needed before making a request
   * @returns {number} Delay in milliseconds (-1 if blocked)
   */
  function calculateDelay() {
    pruneOldTimestamps();

    const count = state.timestamps.length;
    const { maxRequests, throttleThreshold, minDelayMs, windowMs } =
      state.config;
    const throttleAt = Math.floor(maxRequests * throttleThreshold);

    // Below throttle threshold - use minimum delay
    if (count < throttleAt) {
      return minDelayMs;
    }

    // At or above limit - cannot make request
    if (count >= maxRequests) {
      return -1; // Signal that request should be blocked
    }

    // In throttle zone - calculate delay to spread remaining requests
    const remaining = maxRequests - count;
    const oldestTimestamp = state.timestamps[0] || Date.now();
    const windowEnd = oldestTimestamp + windowMs;
    const timeUntilWindowEnd = Math.max(0, windowEnd - Date.now());

    // Calculate delay to evenly space remaining requests
    const calculatedDelay = Math.ceil(timeUntilWindowEnd / remaining);

    // Use at least the minimum delay, cap at reasonable maximum (30 seconds)
    return Math.min(Math.max(calculatedDelay, minDelayMs), 30000);
  }

  /**
   * Check if a request can be made (not blocked)
   * @returns {boolean} True if request is allowed
   */
  function canMakeRequest() {
    pruneOldTimestamps();
    return state.timestamps.length < state.config.maxRequests;
  }

  /**
   * Record a request timestamp
   */
  function recordRequest() {
    state.timestamps.push(Date.now());
  }

  /**
   * Wait for the appropriate delay before making a request
   * @param {boolean} [verbose=false] - Log throttling info
   * @returns {Promise<{allowed: boolean, waited: number, blocked: boolean}>}
   */
  async function waitForSlot(verbose = false) {
    const delay = calculateDelay();
    const { name } = state.config;

    // Blocked - at rate limit
    if (delay < 0) {
      const status = getStatus();
      if (verbose) {
        log.warn(
          `[${name}] Rate limit reached (${status.count}/${status.limit}). Request blocked.`,
        );
      }
      return { allowed: false, waited: 0, blocked: true };
    }

    // Throttling - need to wait longer than minimum
    if (delay > state.config.minDelayMs) {
      const status = getStatus();
      if (verbose) {
        log.debug(
          `[${name}] Throttling: ${status.count}/${status.limit} requests. Waiting ${delay}ms...`,
        );
      }
    }

    // Wait the calculated delay
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    return { allowed: true, waited: delay, blocked: false };
  }

  /**
   * Acquire a slot for making a request
   * Combines waiting and recording in one call
   * @param {boolean} [verbose=false] - Log throttling info
   * @returns {Promise<{allowed: boolean, waited: number, blocked: boolean}>}
   */
  async function acquireSlot(verbose = false) {
    const result = await waitForSlot(verbose);

    if (result.allowed) {
      recordRequest();
    }

    return result;
  }

  /**
   * Update configuration
   * @param {Object} newConfig - Configuration options to update
   */
  function configure(newConfig) {
    state.config = { ...state.config, ...newConfig };
  }

  /**
   * Reset the rate limiter (clears all timestamps)
   */
  function reset() {
    state.timestamps = [];
  }

  /**
   * Get time until the oldest request expires from the window
   * @returns {number} Milliseconds until a slot opens, or 0 if not blocked
   */
  function getTimeUntilSlotAvailable() {
    pruneOldTimestamps();

    if (state.timestamps.length < state.config.maxRequests) {
      return 0;
    }

    const oldestTimestamp = state.timestamps[0];
    const expiresAt = oldestTimestamp + state.config.windowMs;
    return Math.max(0, expiresAt - Date.now());
  }

  return {
    getRequestCount,
    getStatus,
    calculateDelay,
    canMakeRequest,
    recordRequest,
    waitForSlot,
    acquireSlot,
    configure,
    reset,
    getTimeUntilSlotAvailable,
  };
}

/**
 * Get or create a named rate limiter instance
 * @param {string} name - Instance name
 * @param {Object} [config] - Configuration (only used on first creation)
 * @returns {Object} Rate limiter instance
 */
export function getRateLimiter(name, config = {}) {
  if (!instances.has(name)) {
    instances.set(name, createRateLimiter({ ...config, name }));
  }
  return instances.get(name);
}

/**
 * Reset all rate limiter instances
 * Useful for testing
 */
export function resetAll() {
  for (const instance of instances.values()) {
    instance.reset();
  }
  instances.clear();
}

// ============================================
// Pre-configured API rate limiters
// ============================================

/**
 * GetSongBPM rate limiter: 3000 requests per hour
 */
export const getsongbpmLimiter = createRateLimiter({
  name: 'GetSongBPM',
  maxRequests: 3000,
  windowMs: 60 * 60 * 1000, // 1 hour
  throttleThreshold: 0.8,
  minDelayMs: 100,
});

/**
 * Discogs rate limiter (authenticated): 60 requests per minute
 */
export const discogsAuthLimiter = createRateLimiter({
  name: 'Discogs (auth)',
  maxRequests: 60,
  windowMs: 60 * 1000, // 1 minute
  throttleThreshold: 0.8,
  minDelayMs: 50,
});

/**
 * Discogs rate limiter (unauthenticated): 25 requests per minute
 */
export const discogsUnauthLimiter = createRateLimiter({
  name: 'Discogs (unauth)',
  maxRequests: 25,
  windowMs: 60 * 1000, // 1 minute
  throttleThreshold: 0.8,
  minDelayMs: 100,
});

// ============================================
// Backward-compatible exports (use GetSongBPM limiter)
// ============================================

export const getRequestCount = () => getsongbpmLimiter.getRequestCount();
export const getStatus = () => getsongbpmLimiter.getStatus();
export const calculateDelay = () => getsongbpmLimiter.calculateDelay();
export const canMakeRequest = () => getsongbpmLimiter.canMakeRequest();
export const recordRequest = () => getsongbpmLimiter.recordRequest();
export const waitForSlot = (verbose) => getsongbpmLimiter.waitForSlot(verbose);
export const acquireSlot = (verbose) => getsongbpmLimiter.acquireSlot(verbose);
export const configure = (config) => getsongbpmLimiter.configure(config);
export const reset = () => {
  getsongbpmLimiter.reset();
  // Also reset config for backward compatibility with tests
  getsongbpmLimiter.configure({
    maxRequests: 3000,
    windowMs: 60 * 60 * 1000,
    throttleThreshold: 0.8,
    minDelayMs: 100,
  });
};
export const getTimeUntilSlotAvailable = () =>
  getsongbpmLimiter.getTimeUntilSlotAvailable();
