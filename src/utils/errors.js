class ValidationError extends Error {
  constructor(message, details = undefined) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
    this.exitCode = 2;
  }
}

class DuplicateJobError extends Error {
  constructor(id) {
    super(`Job with id "${id}" already exists.`);
    this.name = 'DuplicateJobError';
    this.exitCode = 1;
  }
}

module.exports = {
  DuplicateJobError,
  ValidationError,
};
