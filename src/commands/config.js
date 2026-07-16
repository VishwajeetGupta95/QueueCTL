const { getDatabase } = require('../db');
const { ConfigService } = require('../services/configService');
const { printJson } = require('../utils/output');

function registerConfigCommand(program) {
  const config = program
    .command('config')
    .description('Manage queue configuration.');

  config
    .command('set')
    .description('Set a queue configuration value.')
    .argument('<key>', 'Configuration key: max-retries or backoff-base')
    .argument('<value>', 'Configuration value')
    .action((key, value) => {
      const service = new ConfigService(getDatabase());
      printJson(service.set(key, value));
    });
}

module.exports = registerConfigCommand;
