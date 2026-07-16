const { parseJobJson } = require('../queue/validation');
const { createQueueService } = require('../services/queueFactory');
const { printJson } = require('../utils/output');

function registerEnqueueCommand(program) {
  program
    .command('enqueue')
    .description('Enqueue a job from a JSON payload.')
    .argument('<json>', 'Job JSON, for example: {"command":"echo hello"}')
    .action((json) => {
      const queue = createQueueService();
      const job = queue.enqueue(parseJobJson(json));
      printJson(job);
    });
}

module.exports = registerEnqueueCommand;
