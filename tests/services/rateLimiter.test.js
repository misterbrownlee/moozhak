import { jest } from '@jest/globals';

// Mock logger
jest.unstable_mockModule('../../core/logger.js', () => ({
  log: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const {
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
} = await import('../../core/services/rateLimiter.js');

describe('Rate Limiter', () => {
  beforeEach(() => {
    reset();
  });

  describe('getRequestCount', () => {
    it('returns 0 when no requests made', () => {
      expect(getRequestCount()).toBe(0);
    });

    it('returns correct count after recording requests', () => {
      recordRequest();
      recordRequest();
      recordRequest();
      expect(getRequestCount()).toBe(3);
    });
  });

  describe('getStatus', () => {
    it('returns correct initial status', () => {
      const status = getStatus();
      expect(status.count).toBe(0);
      expect(status.limit).toBe(3000);
      expect(status.remaining).toBe(3000);
      expect(status.isThrottling).toBe(false);
      expect(status.isBlocked).toBe(false);
    });

    it('shows throttling when above threshold', () => {
      // Configure lower limit for testing
      configure({ maxRequests: 10, throttleThreshold: 0.8 });

      // Add 8 requests (80% of 10)
      for (let i = 0; i < 8; i++) {
        recordRequest();
      }

      const status = getStatus();
      expect(status.isThrottling).toBe(true);
      expect(status.isBlocked).toBe(false);
    });

    it('shows blocked when at limit', () => {
      configure({ maxRequests: 5 });

      for (let i = 0; i < 5; i++) {
        recordRequest();
      }

      const status = getStatus();
      expect(status.isBlocked).toBe(true);
    });
  });

  describe('canMakeRequest', () => {
    it('returns true when under limit', () => {
      expect(canMakeRequest()).toBe(true);
    });

    it('returns false when at limit', () => {
      configure({ maxRequests: 3 });

      recordRequest();
      recordRequest();
      recordRequest();

      expect(canMakeRequest()).toBe(false);
    });
  });

  describe('calculateDelay', () => {
    it('returns minimum delay when under throttle threshold', () => {
      configure({ minDelayMs: 100, throttleThreshold: 0.8, maxRequests: 10 });

      const delay = calculateDelay();
      expect(delay).toBe(100);
    });

    it('returns -1 when at limit (blocked)', () => {
      configure({ maxRequests: 2 });

      recordRequest();
      recordRequest();

      const delay = calculateDelay();
      expect(delay).toBe(-1);
    });

    it('returns increased delay when in throttle zone', () => {
      configure({
        maxRequests: 10,
        throttleThreshold: 0.5,
        minDelayMs: 100,
      });

      // Add 6 requests (60% - in throttle zone)
      for (let i = 0; i < 6; i++) {
        recordRequest();
      }

      const delay = calculateDelay();
      // Should be greater than min delay when throttling
      expect(delay).toBeGreaterThanOrEqual(100);
    });
  });

  describe('recordRequest', () => {
    it('increments request count', () => {
      expect(getRequestCount()).toBe(0);
      recordRequest();
      expect(getRequestCount()).toBe(1);
      recordRequest();
      expect(getRequestCount()).toBe(2);
    });
  });

  describe('waitForSlot', () => {
    it('returns allowed when under limit', async () => {
      configure({ minDelayMs: 0 });

      const result = await waitForSlot();

      expect(result.allowed).toBe(true);
      expect(result.blocked).toBe(false);
    });

    it('returns blocked when at limit', async () => {
      configure({ maxRequests: 1, minDelayMs: 0 });
      recordRequest();

      const result = await waitForSlot();

      expect(result.allowed).toBe(false);
      expect(result.blocked).toBe(true);
    });
  });

  describe('acquireSlot', () => {
    it('records request when allowed', async () => {
      configure({ minDelayMs: 0 });

      expect(getRequestCount()).toBe(0);
      const result = await acquireSlot();

      expect(result.allowed).toBe(true);
      expect(getRequestCount()).toBe(1);
    });

    it('does not record request when blocked', async () => {
      configure({ maxRequests: 1, minDelayMs: 0 });
      recordRequest();

      const initialCount = getRequestCount();
      await acquireSlot();

      expect(getRequestCount()).toBe(initialCount);
    });
  });

  describe('configure', () => {
    it('allows changing maxRequests', () => {
      configure({ maxRequests: 100 });

      const status = getStatus();
      expect(status.limit).toBe(100);
    });

    it('allows changing throttleThreshold', () => {
      configure({ maxRequests: 100, throttleThreshold: 0.5 });

      const status = getStatus();
      expect(status.throttleThreshold).toBe(50);
    });

    it('preserves other settings when partially configuring', () => {
      configure({ maxRequests: 100 });
      configure({ throttleThreshold: 0.9 });

      const status = getStatus();
      expect(status.limit).toBe(100);
      expect(status.throttleThreshold).toBe(90);
    });
  });

  describe('reset', () => {
    it('clears all request timestamps', () => {
      recordRequest();
      recordRequest();
      expect(getRequestCount()).toBe(2);

      reset();
      expect(getRequestCount()).toBe(0);
    });

    it('resets configuration to defaults', () => {
      configure({ maxRequests: 100 });
      reset();

      const status = getStatus();
      expect(status.limit).toBe(3000);
    });
  });

  describe('getTimeUntilSlotAvailable', () => {
    it('returns 0 when slots are available', () => {
      expect(getTimeUntilSlotAvailable()).toBe(0);
    });

    it('returns positive value when blocked', () => {
      configure({ maxRequests: 1, windowMs: 60000 });
      recordRequest();

      const waitTime = getTimeUntilSlotAvailable();
      // Should be close to 60 seconds (within a few ms of recording)
      expect(waitTime).toBeGreaterThan(59000);
      expect(waitTime).toBeLessThanOrEqual(60000);
    });
  });

  describe('sliding window behavior', () => {
    it('prunes old timestamps outside window', async () => {
      // Use a very short window for testing
      configure({ maxRequests: 10, windowMs: 50 });

      recordRequest();
      recordRequest();
      expect(getRequestCount()).toBe(2);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Old requests should be pruned
      expect(getRequestCount()).toBe(0);
    });
  });
});
