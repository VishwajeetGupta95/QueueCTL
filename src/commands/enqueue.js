const { parseJobJson } = require('../queue/validation');
const { createQueueService } = require('../services/queueFactory');
const { printJson } = require('../utils/output');

function registerEnqueueCommand(program) {
  program
    .command('enqueue')
    .description('Enqueue a job from a JSON payload.')
    .argument('<json>', 'Job JSON. Required field: command. Optional: id, max_retries, available_at.')
    .addHelpText('after', `
Examples:
  $ queuectl enqueue '{"command":"echo hello"}'
  $ queuectl enqueue '{"id":"nightly","command":"npm test","max_retries":5}'
  $ queuectl enqueue '{"command":"echo later","available_at":"2030-01-01T00:00:00Z"}'
`)
    .action((json) => {
      const queue = createQueueService();
      const job = queue.enqueue(parseJobJson(json));
      printJson(job);
    });
}

module.exports = registerEnqueueCommand;
