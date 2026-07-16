const { getDatabase } = require('../db');
const { ConfigService } = require('../services/configService');
const { printJson } = require('../utils/output');

function registerConfigCommand(program) {
  const config = program
    .command('config')
    .description('Manage queue configuration.')
    .addHelpText('after', `
Examples:
  $ queuectl config set max-retries 5
  $ queuectl config set backoff-base 2
`);

  config
    .command('set')
    .description('Set a queue configuration value.')
    .argument('<key>', 'Configuration key: max-retries or backoff-base')
    .argument('<value>', 'Configuration value')
    .addHelpText('after', `
Supported keys:
  max-retries   Default max retry attempts for newly enqueued jobs
  backoff-base  Base used for retry delay: base ^ attempts seconds
`)
    .action((key, value) => {
      const service = new ConfigService(getDatabase());
      printJson(service.set(key, value));
    });
}

module.exports = registerConfigCommand;
