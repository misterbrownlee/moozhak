#!/usr/bin/env node
import { program } from 'commander';
import { runSearch, runTracks, startSession } from './lib/session.js';

program
  .name('moozhak')
  .description('CLI tool for searching Discogs and getting track information')
  .version('2.0.0')
  .option('-t, --token <token>', 'Discogs personal access token')
  .action((options) => {
    // Default action: start interactive session
    startSession(options);
  });

// Non-interactive search command
program
  .command('search <query>')
  .description('Search Discogs (non-interactive)')
  .option('--type <type>', 'Filter by type: artist, release, master, label')
  .option('--limit <n>', 'Results per page', '5')
  .option('-v, --verbose', 'Show verbose output')
  .action(async (query, options, cmd) => {
    const globalOpts = cmd.parent.opts();
    await runSearch(query, { ...globalOpts, ...options });
    process.exit(0);
  });

// Non-interactive tracks command
program
  .command('tracks <id>')
  .description('Get tracklist from a master or release (non-interactive)')
  .option('--type <type>', 'Source type: master or release', 'master')
  .option(
    '--format <fmt>',
    'Output format: human, csv, pipe, markdown',
    'human',
  )
  .option('-v, --verbose', 'Show verbose output')
  .action(async (id, options, cmd) => {
    const globalOpts = cmd.parent.opts();
    await runTracks(id, { ...globalOpts, ...options });
    process.exit(0);
  });

program.parse();
