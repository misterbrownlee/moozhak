import { commands, findCommand, getCommandNames } from './registry.js';
import { log, writeLog } from '../logger.js';

/**
 * Parse input into command and arguments
 * @param {string} input - Raw user input
 * @returns {{ command: string, args: string[] }}
 */
function parseInput(input) {
  const trimmed = input.trim();
  if (!trimmed) return { command: '', args: [] };

  // Parse respecting quoted strings
  const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const command = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1).map(arg => arg.replace(/^"|"$/g, '')); // Remove quotes

  return { command, args };
}

/**
 * Execute a command from user input
 * @param {string} input - User input string
 * @param {Object} ctx - Context object { db, sessionFlags, updatePrompt }
 * @returns {Promise<boolean>} - true to continue REPL, false to exit
 */
export async function executeCommand(input, ctx) {
  const { command, args } = parseInput(input);
  
  if (!command) return true;

  // Log the command
  writeLog(`Command: ${input.trim()}`);

  // Verbose command echo
  if (ctx.sessionFlags.verbose) {
    log.debug(`\n┌─ Command ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─`);
    log.debug(`│ Input: ${input.trim()}`);
    log.debug('└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─');
  } else {
    log.header(`\n────────────────────────────────────────────────────`);
  }

  const cmd = findCommand(command);
  let cmdResult;

  if (!cmd) {
    log.error(`Unknown command: ${command}`);
    log.info("Type 'help' for available commands.");
    cmdResult = true;
  } else if (cmd.minArgs && args.length < cmd.minArgs) {
    log.error(`Missing arguments`);
    log.info(`Usage: ${cmd.usage}`);
    cmdResult = true;
  }

  if (!cmdResult) {
    cmdResult = await cmd.handler(args, ctx);
  } 

  log.header(`\n────────────────────────────────────────────────────\n`);

  return cmdResult;
}

export { commands, findCommand, getCommandNames };
