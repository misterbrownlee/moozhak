import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { projectRoot } from './config.js';
import { log } from './logger.js';

export const distDir = join(projectRoot, 'dist');

/**
 * Ensure dist folder structure exists
 */
export function ensureDistDir() {
  const dirs = [
    distDir,
    join(distDir, 'json'),
    join(distDir, 'logs')
  ];
  
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Write JSON output to dist/json
 * @param {Object} output - Output data to write
 */
export function writeJsonOutput(output) {
  const outputDir = join(projectRoot, 'dist', 'json');
  
  // Create dist/json directory if it doesn't exist
  mkdirSync(outputDir, { recursive: true });
  
  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${output.type}-${timestamp}.json`;
  const filepath = join(outputDir, filename);
  
  writeFileSync(filepath, JSON.stringify(output, null, 2));
  log.success(`Output saved to: ${filepath}`);
}

