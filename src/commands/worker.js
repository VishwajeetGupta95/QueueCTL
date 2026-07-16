const { getDatabase } = require('../db');
const { ConfigService } = require('../services/configService');
const WorkerEngine = require('../workers/workerEngine');
const { ValidationError } = require('../utils/errors');
const { printJson } = require('../utils/output');

function parseWorkerCount(value) {
  const count = Number.parseInt(value, 10);
  if (!Number.isInteger(count) || count < 1) {
    throw new ValidationError('worker count must be a positive integer.');
  }
  return count;
}

function registerWorkerCommand(program) {
  const worker = program
    .command('worker')
    .description('Manage queue workers.');

  worker
    .command('start')
    .description('Start one or more workers that continuously process pending jobs.')
    .option('-c, --count <count>', 'Number of worker loops to start.', '1')
    .action(async (options) => {
      const count = parseWorkerCount(options.count);
      const engine = new WorkerEngine(getDatabase(), { count });
      await engine.start();
    });

  worker
    .command('stop')
    .description('Request graceful shutdown for running workers.')
    .action(() => {
      const service = new ConfigService(getDatabase());
      service.requestWorkerStop();
      printJson({ stopped: true });
    });
}

module.exports = registerWorkerCommand;
