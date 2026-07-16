const config = require('../config');
const ConfigRepository = require('../db/configRepository');
const { ValidationError } = require('../utils/errors');

const CONFIG_KEYS = Object.freeze({
  MAX_RETRIES: 'max-retries',
  BACKOFF_BASE: 'backoff-base',
  WORKER_STOP_REQUESTED: 'worker-stop-requested',
});

const DEFAULTS = Object.freeze({
  [CONFIG_KEYS.MAX_RETRIES]: config.defaultMaxRetries,
  [CONFIG_KEYS.BACKOFF_BASE]: config.defaultBackoffBase,
  [CONFIG_KEYS.WORKER_STOP_REQUESTED]: '0',
});

class ConfigService {
  constructor(db) {
    this.repository = new ConfigRepository(db);
  }

  get(key) {
    return this.repository.get(key) ?? DEFAULTS[key];
  }

  getNumber(key) {
    const value = Number(this.get(key));
    if (!Number.isFinite(value)) {
      throw new ValidationError(`Configuration value ${key} must be numeric.`);
    }
    return value;
  }

  set(key, value) {
    if (!Object.values(CONFIG_KEYS).includes(key) || key === CONFIG_KEYS.WORKER_STOP_REQUESTED) {
      throw new ValidationError(`Unsupported config key: ${key}.`);
    }

    const numericValue = Number(value);
    if (!Number.isInteger(numericValue) || numericValue < 0) {
      throw new ValidationError(`${key} must be a non-negative integer.`);
    }

    if (key === CONFIG_KEYS.BACKOFF_BASE && numericValue < 1) {
      throw new ValidationError('backoff-base must be at least 1.');
    }

    this.repository.set(key, String(numericValue));
    return { key, value: numericValue };
  }

  requestWorkerStop() {
    this.repository.set(CONFIG_KEYS.WORKER_STOP_REQUESTED, '1');
  }

  clearWorkerStop() {
    this.repository.set(CONFIG_KEYS.WORKER_STOP_REQUESTED, '0');
  }

  isWorkerStopRequested() {
    return this.repository.get(CONFIG_KEYS.WORKER_STOP_REQUESTED) === '1';
  }
}

module.exports = {
  CONFIG_KEYS,
  ConfigService,
};
