const { spawn } = require('node:child_process');
const config = require('../config');
const { ConfigService } = require('../services/configService');
const QueueService = require('../services/queueService');
const logger = require('../utils/logger');

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseCommand(command) {
  try {
    const parsed = JSON.parse(command);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const [file, ...args] = parsed;
      return { file, args, shell: false };
    }
  } catch (_error) {
    // Command is not a JSON array; execute as a shell command string.
  }

  return { file: command, args: [], shell: true };
}

class WorkerEngine {
  constructor(db, options = {}) {
    this.db = db;
    this.queue = new QueueService(db);
    this.config = new ConfigService(db);
    this.count = options.count;
    this.pollIntervalMs = options.pollIntervalMs || config.workerPollIntervalMs;
    this.isStopping = false;
    this.exitWhenIdle = Boolean(options.once);
    this.activeJobs = new Set();
  }

  async start() {
    this.config.clearWorkerStop();
    logger.info('Worker engine started.', { count: this.count });
    this.registerSignals();

    await Promise.all(
      Array.from({ length: this.count }, (_value, index) => this.runWorker(index + 1)),
    );

    logger.info('Worker engine stopped.');
  }

  registerSignals() {
    const shutdown = (signal) => {
      logger.info('Shutdown signal received. Waiting for active jobs to finish.', { signal });
      this.isStopping = true;
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  }

  async runWorker(workerId) {
    logger.info('Worker loop started.', { workerId });

    while (!this.isStopping && !this.config.isWorkerStopRequested()) {
      const job = this.queue.getPendingJob();

      if (!job) {
        if (this.exitWhenIdle) {
          // Exit when there are no more jobs to process.
          break;
        }

        await sleep(this.pollIntervalMs);
        continue;
      }

      this.activeJobs.add(job.id);
      try {
        await this.executeJob(workerId, job);
      } finally {
        this.activeJobs.delete(job.id);
      }
    }

    logger.info('Worker loop exiting.', { workerId });
  }

  async executeJob(workerId, job) {
    logger.info('Job started.', { workerId, jobId: job.id, attempt: job.attempts });

    let result;
    try {
      result = await this.runShellCommand(job.command);
    } catch (error) {
      result = { exitCode: 1, error: error.message };
      logger.error('Job command failed to start.', {
        workerId,
        jobId: job.id,
        error: error.message,
      });
    }

    if (result.exitCode === 0) {
      this.queue.markCompleted(job.id);
      logger.info('Job completed.', { workerId, jobId: job.id });
      return;
    }

    const updated = this.queue.retryJob(job.id);
    logger.warn('Job failed.', {
      workerId,
      jobId: job.id,
      exitCode: result.exitCode,
      error: result.error,
      state: updated?.state,
      nextAvailableAt: updated?.available_at,
    });
  }

  runShellCommand(command) {
    const parsed = parseCommand(command);

    return new Promise((resolve, reject) => {
      const child = spawn(parsed.file, parsed.args, {
        shell: parsed.shell,
        stdio: 'inherit',
      });

      child.on('error', reject);
      child.on('close', (exitCode, signal) => {
        resolve({ exitCode: exitCode ?? 1, signal });
      });
    });
  }
}

module.exports = WorkerEngine;
