import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
    join(distDir, 'logs'),
    join(distDir, 'tracks'),
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

/**
 * Write tracks output to dist/tracks
 * @param {string} content - Formatted track listing content
 * @param {number} id - Release/master ID
 * @param {string} format - Output format (human, csv, pipe, markdown)
 * @param {string} artist - Artist name
 * @param {string} releaseName - Release name
 */
export function writeTracksOutput(content, id, format, artist, releaseName) {
  const outputDir = join(projectRoot, 'dist', 'tracks');

  // Create dist/tracks directory if it doesn't exist
  mkdirSync(outputDir, { recursive: true });

  // Sanitize and truncate names
  const sanitize = (str) =>
    str
      .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Spaces to dashes
      .toLowerCase()
      .substring(0, 15);

  const sanitizedArtist = sanitize(artist);
  const sanitizedRelease = sanitize(releaseName);

  // Determine file extension based on format
  const extensions = {
    human: 'txt',
    csv: 'csv',
    pipe: 'txt',
    markdown: 'md',
  };
  const ext = extensions[format] || 'txt';

  const filename = `${id}-${sanitizedArtist}-${sanitizedRelease}.${ext}`;
  const filepath = join(outputDir, filename);

  writeFileSync(filepath, content);
  log.success(`Tracks saved to: ${filepath}`);
}
