import { existsSync, rmSync } from 'fs';
import { distDir } from '../output.js';

/**
 * Handle clean command - delete dist folder contents
 */
export function handleClean() {
  if (!existsSync(distDir)) {
    console.log('dist folder does not exist. Nothing to clean.');
    return;
  }
  
  try {
    rmSync(distDir, { recursive: true, force: true });
    console.log('Cleaned dist folder (json output and logs).');
  } catch (error) {
    console.error('Error cleaning dist folder:', error.message);
    process.exit(1);
  }
}

