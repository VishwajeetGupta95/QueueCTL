const { createQueueService } = require('../services/queueFactory');
const { printJson } = require('../utils/output');

function registerListCommand(program) {
  program
    .command('list')
    .description('List jobs, optionally filtered by state.')
    .option('-s, --state <state>', 'Filter by state: pending, processing, completed, failed, dead')
    .addHelpText('after', `
Examples:
  $ queuectl list
  $ queuectl list --state pending
  $ queuectl list --state completed
`)
    .action((options) => {
      const queue = createQueueService();
      printJson(queue.listJobs(options.state));
    });
}

module.exports = registerListCommand;
