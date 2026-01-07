import { log, writeLog } from '../logger.js';

/**
 * Exit command definition
 */
export const exitCommand = {
  name: 'exit',
  aliases: ['quit', 'q'],
  minArgs: 0,
  usage: 'exit',
  description: 'Exit the session',
  handler: async () => {
    writeLog('Session ended by user');
    log.plain('');
    log.success('Goodbye!');
    return false; // Signal to exit REPL
  },
};

