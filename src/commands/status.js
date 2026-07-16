const { createQueueService } = require('../services/queueFactory');
const { printJson } = require('../utils/output');

function registerStatusCommand(program) {
  program
    .command('status')
    .description('Show queue status counts by state.')
    .action(() => {
      const queue = createQueueService();
      printJson(queue.getStatus());
    });
}

module.exports = registerStatusCommand;
