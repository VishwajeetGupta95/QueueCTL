const crypto = require('node:crypto');
const config = require('../config');
const { VALID_JOB_STATES } = require('./states');
const { ValidationError } = require('../utils/errors');
const { toIsoDate } = require('../utils/time');

function assertPlainObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(message);
  }
}

function parseJobJson(json) {
  try {
    const parsed = JSON.parse(json);
    assertPlainObject(parsed, 'Job payload must be a JSON object.');
    return parsed;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(`Invalid JSON: ${error.message}`);
  }
}

function normalizeCommand(command) {
  if (typeof command === 'string') {
    const trimmed = command.trim();
    if (!trimmed) {
      throw new ValidationError('command must be a non-empty string.');
    }
    return trimmed;
  }

  if (Array.isArray(command) && command.every((part) => typeof part === 'string' && part.length > 0)) {
    return JSON.stringify(command);
  }

  throw new ValidationError('command must be a non-empty string or an array of non-empty strings.');
}

function normalizeNonNegativeInteger(value, fieldName, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${fieldName} must be a non-negative integer.`);
  }

  return value;
}

function normalizeJob(input) {
  assertPlainObject(input, 'Job must be an object.');

  const id = input.id === undefined || input.id === null || input.id === ''
    ? crypto.randomUUID()
    : String(input.id).trim();

  if (!id) {
    throw new ValidationError('id must be a non-empty string when provided.');
  }

  let availableAt;
  try {
    availableAt = toIsoDate(input.available_at || input.availableAt, 'available_at');
  } catch (error) {
    throw new ValidationError(error.message);
  }

  return {
    id,
    command: normalizeCommand(input.command),
    max_retries: normalizeNonNegativeInteger(input.max_retries ?? input.maxRetries, 'max_retries', config.defaultMaxRetries),
    available_at: availableAt,
  };
}

function validateState(state) {
  if (state !== undefined && !VALID_JOB_STATES.includes(state)) {
    throw new ValidationError(`state must be one of: ${VALID_JOB_STATES.join(', ')}.`);
  }
}

module.exports = {
  normalizeJob,
  parseJobJson,
  validateState,
};
