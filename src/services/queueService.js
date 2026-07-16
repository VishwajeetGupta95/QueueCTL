const { JOB_STATES } = require('../queue/states');
const { ConfigService, CONFIG_KEYS } = require('./configService');
const { normalizeJob, validateState } = require('../queue/validation');
const { DuplicateJobError, ValidationError } = require('../utils/errors');
const { nowIso } = require('../utils/time');

class QueueService {
  constructor(db) {
    this.db = db;
    this.config = new ConfigService(db);
  }

  enqueue(job) {
    const normalized = normalizeJob(job);
    if (job.max_retries === undefined && job.maxRetries === undefined) {
      normalized.max_retries = this.config.getNumber(CONFIG_KEYS.MAX_RETRIES);
    }
    const timestamp = nowIso();
    const payload = {
      ...normalized,
      state: JOB_STATES.PENDING,
      attempts: 0,
      created_at: timestamp,
      updated_at: timestamp,
      available_at: normalized.available_at || timestamp,
    };

    try {
      this.db.prepare(`
        INSERT INTO jobs (id, command, state, attempts, max_retries, created_at, updated_at, available_at)
        VALUES (@id, @command, @state, @attempts, @max_retries, @created_at, @updated_at, @available_at)
      `).run(payload);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new DuplicateJobError(payload.id);
      }
      throw error;
    }

    return this.getJob(payload.id);
  }

  getJob(id) {
    return this.db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  }

  getPendingJob() {
    const timestamp = nowIso();
    const transaction = this.db.transaction(() => {
      const job = this.db.prepare(`
        SELECT * FROM jobs
        WHERE state = ? AND available_at <= ?
        ORDER BY available_at ASC, created_at ASC
        LIMIT 1
      `).get(JOB_STATES.PENDING, timestamp);

      if (!job) {
        return undefined;
      }

      const result = this.db.prepare(`
        UPDATE jobs
        SET state = ?, attempts = attempts + 1, updated_at = ?
        WHERE id = ? AND state = ?
      `).run(JOB_STATES.PROCESSING, timestamp, job.id, JOB_STATES.PENDING);

      return result.changes > 0 ? this.getJob(job.id) : undefined;
    });

    return transaction();
  }

  updateJob(id, updates) {
    if (!id) {
      throw new ValidationError('id is required.');
    }
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      throw new ValidationError('updates must be an object.');
    }

    const allowedFields = ['state', 'attempts', 'max_retries', 'available_at'];
    const assignments = [];
    const params = { id, updated_at: nowIso() };

    for (const field of allowedFields) {
      if (Object.hasOwn(updates, field)) {
        if (field === 'state') {
          validateState(updates[field]);
        }
        assignments.push(`${field} = @${field}`);
        params[field] = updates[field];
      }
    }

    if (assignments.length === 0) {
      throw new ValidationError(`updates must include at least one of: ${allowedFields.join(', ')}.`);
    }

    assignments.push('updated_at = @updated_at');
    const result = this.db.prepare(`UPDATE jobs SET ${assignments.join(', ')} WHERE id = @id`).run(params);
    return result.changes > 0 ? this.getJob(id) : undefined;
  }

  markCompleted(id) {
    return this.updateJob(id, { state: JOB_STATES.COMPLETED });
  }

  markFailed(id, availableAt = nowIso()) {
    const job = this.getJob(id);
    if (!job) {
      return undefined;
    }

    if (job.attempts >= job.max_retries) {
      return this.moveToDLQ(id);
    }

    return this.updateJob(id, {
      state: JOB_STATES.FAILED,
      available_at: availableAt,
    });
  }

  moveToDLQ(id) {
    return this.updateJob(id, { state: JOB_STATES.DEAD });
  }


  retryJob(id, backoffBase = this.config.getNumber(CONFIG_KEYS.BACKOFF_BASE)) {
    const job = this.getJob(id);
    if (!job) {
      return undefined;
    }

    if (job.attempts >= job.max_retries) {
      return this.moveToDLQ(id);
    }

    const delaySeconds = backoffBase ** job.attempts;
    const availableAt = new Date(Date.now() + delaySeconds * 1000).toISOString();

    return this.updateJob(id, {
      state: JOB_STATES.PENDING,
      available_at: availableAt,
    });
  }

  retryDeadJob(id) {
    const job = this.getJob(id);
    if (!job) {
      return undefined;
    }
    if (job.state !== JOB_STATES.DEAD) {
      throw new ValidationError('Only dead jobs can be retried from the DLQ.');
    }
    return this.updateJob(id, {
      state: JOB_STATES.PENDING,
      available_at: nowIso(),
    });
  }

  listJobs(state) {
    validateState(state);
    if (state) {
      return this.db.prepare('SELECT * FROM jobs WHERE state = ? ORDER BY created_at DESC').all(state);
    }
    return this.db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all();
  }

  getStatus() {
    const rows = this.db.prepare('SELECT state, COUNT(*) AS count FROM jobs GROUP BY state').all();
    const status = Object.values(JOB_STATES).reduce((acc, state) => {
      acc[state] = 0;
      return acc;
    }, {});

    for (const row of rows) {
      status[row.state] = row.count;
    }

    status.total = rows.reduce((sum, row) => sum + row.count, 0);
    return status;
  }
}

module.exports = QueueService;
