import { select, input } from '@inquirer/prompts';
import { log, writeLog } from '../logger.js';

/**
 * Valid search types for Discogs
 */
const VALID_TYPES = ['artist', 'release', 'master', 'label'];

/**
 * Valid output formats for tracks
 */
const VALID_OUTPUT_FORMATS = ['human', 'csv', 'pipe', 'markdown'];

/**
 * Settings schema - defines validation, transformation, and display for each setting
 */
const SETTINGS_SCHEMA = {
  type: {
    label: 'Search Type',
    validate: (v) => !v || v === 'none' || v === 'all' || VALID_TYPES.includes(v),
    transform: (v) => (!v || v === 'none' || v === 'all') ? null : v.toLowerCase(),
    format: (v) => v || 'none (all)',
    errorMsg: `Valid types: ${VALID_TYPES.join(', ')}, none`,
    choices: [
      { name: 'all (no filter)', value: null },
      { name: 'artist', value: 'artist' },
      { name: 'release', value: 'release' },
      { name: 'master', value: 'master' },
      { name: 'label', value: 'label' },
    ],
  },

  per_page: {
    label: 'Results Per Page',
    validate: (v) => !isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0,
    transform: (v) => parseInt(v, 10),
    format: (v) => String(v),
    errorMsg: 'Must be a positive number',
    inputType: 'number',
  },

  tracks_type: {
    label: 'Default Tracks Type',
    validate: (v) => ['master', 'release'].includes(v),
    transform: (v) => v.toLowerCase(),
    format: (v) => v,
    errorMsg: 'Valid types: master, release',
    choices: [
      { name: 'master', value: 'master' },
      { name: 'release', value: 'release' },
    ],
  },

  tracks_output: {
    label: 'Tracks Output Format',
    validate: (v) => VALID_OUTPUT_FORMATS.includes(v),
    transform: (v) => v.toLowerCase(),
    format: (v) => v,
    errorMsg: `Valid formats: ${VALID_OUTPUT_FORMATS.join(', ')}`,
    choices: [
      { name: 'human - readable text', value: 'human' },
      { name: 'csv - comma-separated', value: 'csv' },
      { name: 'pipe - pipe-separated', value: 'pipe' },
      { name: 'markdown - table format', value: 'markdown' },
    ],
  },

  verbose: {
    label: 'Verbose Mode',
    validate: () => true,
    transform: (v) => v === 'on' || v === 'true' || v === true,
    format: (v) => v ? 'on' : 'off',
    errorMsg: 'Use: on or off',
    choices: [
      { name: 'off', value: false },
      { name: 'on', value: true },
    ],
  },
};

/**
 * Display current settings
 * @param {Object} sessionFlags - Current session flags
 */
export function showSettings(sessionFlags) {
  log.header('\nCurrent Settings:');
  log.plain('');
  
  for (const [key, schema] of Object.entries(SETTINGS_SCHEMA)) {
    const value = schema.format(sessionFlags[key]);
    log.plain(`  ${schema.label.padEnd(20)} ${value}`);
  }
}

/**
 * Interactive settings menu using Inquirer select
 * @param {Object} sessionFlags - Current session flags
 * @param {Function} updatePrompt - Function to update REPL prompt
 */
export async function handleSettings(sessionFlags, updatePrompt) {
  try {
    // Build choices showing current values
    const choices = Object.entries(SETTINGS_SCHEMA).map(([key, schema]) => ({
      name: `${schema.label}: ${schema.format(sessionFlags[key])}`,
      value: key,
    }));
    choices.push({ name: '← Back', value: 'back' });

    const setting = await select({
      message: 'Which setting to change?',
      choices,
    });

    if (setting === 'back') return;

    const schema = SETTINGS_SCHEMA[setting];

    // If setting has predefined choices, use select
    if (schema.choices) {
      const newValue = await select({
        message: `Select ${schema.label}:`,
        choices: schema.choices,
        default: sessionFlags[setting],
      });
      
      sessionFlags[setting] = newValue;
      log.success(`${schema.label}: ${schema.format(sessionFlags[setting])}`);
    } 
    // Otherwise use text input
    else {
      const newValue = await input({
        message: `Enter ${schema.label}:`,
        default: String(sessionFlags[setting]),
        validate: (v) => schema.validate(v) || schema.errorMsg,
      });
      
      sessionFlags[setting] = schema.transform(newValue);
      log.success(`${schema.label}: ${schema.format(sessionFlags[setting])}`);
    }

    // Update prompt if type changed
    if (setting === 'type' && updatePrompt) {
      updatePrompt();
    }

    writeLog(`Settings updated: ${JSON.stringify(sessionFlags)}`);

  } catch (error) {
    // User cancelled (Ctrl+C in submenu)
    if (error.name === 'ExitPromptError') {
      return;
    }
    throw error;
  }
}

/**
 * Quick set command - set option value directly
 * @param {string[]} args - [option, value] or [] to show settings
 * @param {Object} sessionFlags - Current session flags
 * @param {Function} updatePrompt - Function to update REPL prompt
 */
export function handleSet(args, sessionFlags, updatePrompt) {
  const [option, value] = args;

  // No args = show settings
  if (!option) {
    showSettings(sessionFlags);
    return;
  }

  const key = option.toLowerCase();
  const schema = SETTINGS_SCHEMA[key];

  if (!schema) {
    log.error(`Unknown option: ${option}`);
    log.info(`Available options: ${Object.keys(SETTINGS_SCHEMA).join(', ')}`);
    return;
  }

  // Missing value
  if (value === undefined) {
    log.error(`Missing value for ${option}`);
    log.info(`Current: ${schema.format(sessionFlags[key])}`);
    if (schema.choices) {
      log.info(`Options: ${schema.choices.map(c => c.value ?? c.name).join(', ')}`);
    }
    return;
  }

  const val = value.toLowerCase();

  if (!schema.validate(val)) {
    log.error(`Invalid value '${value}'`);
    log.info(schema.errorMsg);
    return;
  }

  sessionFlags[key] = schema.transform ? schema.transform(val) : val;
  log.success(`${schema.label}: ${schema.format(sessionFlags[key])}`);

  if (key === 'type' && updatePrompt) {
    updatePrompt();
  }

  writeLog(`Settings updated: ${JSON.stringify(sessionFlags)}`);
}

/**
 * Settings command definition
 */
export const settingsCommand = {
  name: 'settings',
  aliases: [],
  minArgs: 0,
  usage: 'settings',
  description: 'Show or change current session settings',
  handler: async (_args, ctx) => {
    await handleSettings(ctx.sessionFlags, ctx.updatePrompt);
    return true;
  },
};

/**
 * Set command definition
 */
export const setCommand = {
  name: 'set',
  aliases: [],
  minArgs: 0,
  usage: 'set [option] [value]',
  description: 'Quick set a session option (or show settings if no args)',
  handler: async (args, ctx) => {
    handleSet(args, ctx.sessionFlags, ctx.updatePrompt);
    return true;
  },
};

export { SETTINGS_SCHEMA, VALID_TYPES, VALID_OUTPUT_FORMATS };

