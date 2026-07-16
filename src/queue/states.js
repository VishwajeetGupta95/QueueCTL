const JOB_STATES = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DEAD: 'dead',
});

const VALID_JOB_STATES = Object.freeze(Object.values(JOB_STATES));

module.exports = {
  JOB_STATES,
  VALID_JOB_STATES,
};
