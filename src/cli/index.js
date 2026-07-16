#!/usr/bin/env node
const { Command, CommanderError } = require('commander');
const registerEnqueueCommand = require('../commands/enqueue');
const registerListCommand = require('../commands/list');
const registerStatusCommand = require('../commands/status');
const registerWorkerCommand = require('../commands/worker');
const registerConfigCommand = require('../commands/config');
const registerDlqCommand = require('../commands/dlq');
const { closeDatabase } = require('../db');
const logger = require('../utils/logger');

function buildProgram() {
  const program = new Command();

  program
    .name('queuectl')
    .description('SQLite-backed CLI job queue for durable shell command execution.')
    .version('0.1.0')
    .showHelpAfterError()
    .showSuggestionAfterError()
    .addHelpText('after', `
Examples:
  $ queuectl enqueue '{"id":"hello","command":"echo hello"}'
  $ queuectl list --state pending
  $ queuectl status
  $ queuectl worker start --count 4
  $ queuectl worker stop
  $ queuectl config set max-retries 5
  $ queuectl config set backoff-base 2
  $ queuectl dlq list
  $ queuectl dlq retry hello
`);

  registerEnqueueCommand(program);
  registerListCommand(program);
  registerStatusCommand(program);
  registerWorkerCommand(program);
  registerConfigCommand(program);
  registerDlqCommand(program);

  return program;
}

function resolveCliArgs(argv = process.argv) {
  if (!Array.isArray(argv) || argv.length <= 2) {
    return [...argv, 'worker', 'start'];
  }

  return argv;
}

async function main(argv = process.argv) {
  const program = buildProgram();
  const resolvedArgv = resolveCliArgs(argv);

  try {
    await program.parseAsync(resolvedArgv);
  } catch (error) {
    if (error instanceof CommanderError) {
      process.exitCode = error.exitCode;
      return;
    }

    const exitCode = error.exitCode || 1;
    logger.error(error.message, {
      name: error.name || 'Error',
      details: error.details,
    });
    process.exitCode = exitCode;
  } finally {
    closeDatabase();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildProgram,
  main,
  resolveCliArgs,
};
