const { getDatabase } = require('../db');
const QueueService = require('./queueService');

function createQueueService() {
  return new QueueService(getDatabase());
}

module.exports = {
  createQueueService,
};
