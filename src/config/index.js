const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config();

const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'queuectl.sqlite');
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BACKOFF_BASE = 2;

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

module.exports = {
  databasePath: path.resolve(process.env.QUEUECTL_DB_PATH || DEFAULT_DB_PATH),
  defaultMaxRetries: toPositiveInteger(
    process.env.QUEUECTL_DEFAULT_MAX_RETRIES,
    DEFAULT_MAX_RETRIES,
  ),
  defaultBackoffBase: toPositiveInteger(
    process.env.QUEUECTL_DEFAULT_BACKOFF_BASE,
    DEFAULT_BACKOFF_BASE,
  ),
  workerPollIntervalMs: toPositiveInteger(process.env.QUEUECTL_WORKER_POLL_INTERVAL_MS, 1000),
};
