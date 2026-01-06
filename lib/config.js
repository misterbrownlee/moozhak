import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

/**
 * Load config from .mzkconfig file
 * Searches in: project directory, current working directory, home directory
 * @returns {Object} Configuration object
 */
export function loadConfig() {
  const config = {};
  const configPaths = [
    join(projectRoot, '.mzkconfig'),      // Project directory
    join(process.cwd(), '.mzkconfig'),     // Current working directory
    join(homedir(), '.mzkconfig')          // Home directory
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        const lines = content.split('\n');
        
        for (const line of lines) {
          const trimmed = line.trim();
          // Skip comments and empty lines
          if (!trimmed || trimmed.startsWith('#')) continue;
          
          const [key, ...valueParts] = trimmed.split('=');
          const value = valueParts.join('=').trim();
          
          if (key && value) {
            config[key.trim()] = value;
          }
        }
        break; // Use first config file found
      } catch (err) {
        // Ignore read errors
      }
    }
  }

  return config;
}

// Export loaded config as singleton
export const fileConfig = loadConfig();

/**
 * Check if verbose mode is enabled
 * @returns {boolean}
 */
export function isVerbose() {
  return Boolean(fileConfig.VERBOSE);
}

/**
 * Get configured results per page
 * @returns {number}
 */
export function getPerPage() {
  const val = parseInt(fileConfig.PER_PAGE, 10);
  return isNaN(val) || val < 1 ? 5 : val;
}

/**
 * Get configured default search type
 * @returns {string|null}
 */
export function getDefaultType() {
  const validTypes = ['artist', 'release', 'master', 'label'];
  const val = fileConfig.DEFAULT_TYPE?.toLowerCase();
  return validTypes.includes(val) ? val : null;
}

/**
 * Get configured default tracks type
 * @returns {string}
 */
export function getDefaultTracksType() {
  const validTypes = ['master', 'release'];
  const val = fileConfig.DEFAULT_TRACKS_TYPE?.toLowerCase();
  return validTypes.includes(val) ? val : 'master';
}

/**
 * Get configured default tracks output format
 * @returns {string}
 */
export function getDefaultTracksOutput() {
  const validFormats = ['human', 'csv', 'pipe', 'markdown'];
  const val = fileConfig.DEFAULT_TRACKS_OUTPUT?.toLowerCase();
  return validFormats.includes(val) ? val : 'human';
}

// Export project root for other modules
export { projectRoot };

