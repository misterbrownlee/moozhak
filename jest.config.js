export default {
  testEnvironment: 'node',
  // Enable ESM support (no transform needed)
  transform: {},
  // Test file patterns
  testMatch: ['**/tests/**/*.test.js'],
  // Module file extensions
  moduleFileExtensions: ['js', 'json'],
  // Coverage settings
  collectCoverageFrom: [
    'core/**/*.js',
    'web/**/*.js',
    '!web/public/**',
    '!web/views/**',
    '!web/src/**',
  ],
  coverageDirectory: 'coverage',
  // Suppress experimental ESM warning
  silent: false,
};
