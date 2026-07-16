#!/usr/bin/env node
const { Command } = require('commander');
const registerEnqueueCommand = require('../commands/enqueue');
const registerListCommand = require('../commands/list');
const registerStatusCommand = require('../commands/status');
const { closeDatabase } = require('../db');

function buildProgram() {
  const program = new Command();

  program
    .name('queuectl')
    .description('SQLite-backed CLI job queue')
    .version('0.1.0')
    .showHelpAfterError();

  registerEnqueueCommand(program);
  registerListCommand(program);
  registerStatusCommand(program);

  return program;
}

async function main(argv = process.argv) {
  const program = buildProgram();

  try {
    await program.parseAsync(argv);
  } catch (error) {
    const exitCode = error.exitCode || 1;
    process.stderr.write(`${error.name || 'Error'}: ${error.message}\n`);
    if (error.details) {
      process.stderr.write(`${JSON.stringify(error.details, null, 2)}\n`);
    }
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
};
