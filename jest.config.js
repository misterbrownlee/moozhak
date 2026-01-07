export default {
  testEnvironment: 'node',
  // Enable ESM support (no transform needed)
  transform: {},
  // Test file patterns
  testMatch: ['**/tests/**/*.test.js'],
  // Module file extensions
  moduleFileExtensions: ['js', 'json'],
  // Coverage settings
  collectCoverageFrom: ['lib/**/*.js', 'cli.js'],
  coverageDirectory: 'coverage',
  // Suppress experimental ESM warning
  silent: false,
};
