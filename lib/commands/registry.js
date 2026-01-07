import { cleanCommand } from './clean.js';
import { exitCommand } from './exit.js';
import { helpCommand } from './help.js';
import { searchCommand } from './search.js';
import { setCommand, settingsCommand } from './settings.js';
import { tracksCommand } from './tracks.js';

/**
 * All command definitions
 */
const commandList = [
  searchCommand,
  tracksCommand,
  settingsCommand,
  setCommand,
  cleanCommand,
  helpCommand,
  exitCommand,
];

/**
 * Command registry - maps command names to handlers
 */
const commands = Object.fromEntries(commandList.map((cmd) => [cmd.name, cmd]));

/**
 * Find a command by name or alias
 * @param {string} name - Command name or alias
 * @returns {Object|null} Command object or null
 */
export function findCommand(name) {
  const lower = name.toLowerCase();

  // Direct match
  if (commands[lower]) {
    return { name: lower, ...commands[lower] };
  }

  // Alias match
  for (const cmd of commandList) {
    if (cmd.aliases.includes(lower)) {
      return { name: cmd.name, ...cmd };
    }
  }

  return null;
}

/**
 * Get list of all command names (for autocomplete)
 */
export function getCommandNames() {
  return Object.keys(commands);
}

export { commands, commandList };
