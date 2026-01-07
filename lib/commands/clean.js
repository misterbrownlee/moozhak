import { existsSync, rmSync } from 'fs';
import { distDir } from '../output.js';
import { log } from '../logger.js';

/**
 * Clean command definition
 */
export const cleanCommand = {
  name: 'clean',
  aliases: [],
  minArgs: 0,
  usage: 'clean',
  description: 'Delete all files in the dist folder',
  handler: async () => {
    handleClean();
    return true;
  },
};

/**
 * Handle clean command - delete dist folder contents
 */
export function handleClean() {
  if (!existsSync(distDir)) {
    log.info('dist folder does not exist. Nothing to clean.');
    return;
  }
  
  try {
    rmSync(distDir, { recursive: true, force: true });
    log.success('Cleaned dist folder (json output and logs).');
  } catch (error) {
    log.error('Error cleaning dist folder:', error.message);
    process.exit(1);
  }
}

