const { createQueueService } = require('../services/queueFactory');
const { JOB_STATES } = require('../queue/states');
const { printJson } = require('../utils/output');

function registerDlqCommand(program) {
  const dlq = program
    .command('dlq')
    .description('Inspect and retry dead-letter queue jobs.')
    .addHelpText('after', `
Examples:
  $ queuectl dlq list
  $ queuectl dlq retry job-123
`);

  dlq
    .command('list')
    .description('List jobs in the dead-letter queue.')
    .action(() => {
      const queue = createQueueService();
      printJson(queue.listJobs(JOB_STATES.DEAD));
    });

  dlq
    .command('retry')
    .description('Move a dead-letter job back to pending.')
    .argument('<jobId>', 'Job id to retry')
    .action((jobId) => {
      const queue = createQueueService();
      printJson(queue.retryDeadJob(jobId));
    });
}

module.exports = registerDlqCommand;
