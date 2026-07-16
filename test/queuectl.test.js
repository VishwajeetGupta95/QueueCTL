const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

function hasRuntimeDependencies() {
  try {
    require.resolve('better-sqlite3');
    return true;
  } catch (_error) {
    return false;
  }
}

const skipWithoutDependencies = hasRuntimeDependencies()
  ? false
  : 'better-sqlite3 is not installed in this environment';

function createTempDatabase() {
  const { createDatabase } = require('../src/db');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'queuectl-'));
  const databasePath = path.join(directory, 'queuectl.sqlite');
  const db = createDatabase(databasePath);
  return {
    db,
    databasePath,
    cleanup() {
      db.close();
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}

test('no-arg invocation defaults to worker start', () => {
  const { resolveCliArgs } = require('../src/cli');

  assert.deepEqual(resolveCliArgs(['node', 'queuectl']), ['node', 'queuectl', 'worker', 'start']);
  assert.deepEqual(resolveCliArgs(['node', 'queuectl', 'status']), ['node', 'queuectl', 'status']);
  assert.deepEqual(resolveCliArgs(['node', 'queuectl', '--help']), ['node', 'queuectl', '--help']);
});

test('enqueue persists a pending job', { skip: skipWithoutDependencies }, () => {
  const { db, cleanup } = createTempDatabase();
  const QueueService = require('../src/services/queueService');

  try {
    const queue = new QueueService(db);
    const job = queue.enqueue({ id: 'enqueue-test', command: 'echo hello', max_retries: 3 });

    assert.equal(job.id, 'enqueue-test');
    assert.equal(job.command, 'echo hello');
    assert.equal(job.state, 'pending');
    assert.equal(job.attempts, 0);
    assert.equal(job.max_retries, 3);
  } finally {
    cleanup();
  }
});

test('successful job is marked completed', { skip: skipWithoutDependencies }, async () => {
  const { db, cleanup } = createTempDatabase();
  const QueueService = require('../src/services/queueService');
  const WorkerEngine = require('../src/workers/workerEngine');

  try {
    const queue = new QueueService(db);
    queue.enqueue({ id: 'success-test', command: 'echo ok', max_retries: 3 });
    const engine = new WorkerEngine(db, { count: 1, pollIntervalMs: 1 });
    engine.runShellCommand = async () => ({ exitCode: 0 });

    const job = queue.getPendingJob();
    await engine.executeJob(1, job);

    assert.equal(queue.getJob('success-test').state, 'completed');
  } finally {
    cleanup();
  }
});

test('failed job is retried as pending with incremented attempts', { skip: skipWithoutDependencies }, async () => {
  const { db, cleanup } = createTempDatabase();
  const QueueService = require('../src/services/queueService');
  const WorkerEngine = require('../src/workers/workerEngine');

  try {
    const queue = new QueueService(db);
    queue.enqueue({ id: 'failure-test', command: 'exit 1', max_retries: 3 });
    const engine = new WorkerEngine(db, { count: 1, pollIntervalMs: 1 });
    engine.runShellCommand = async () => ({ exitCode: 1 });

    const job = queue.getPendingJob();
    await engine.executeJob(1, job);
    const failed = queue.getJob('failure-test');

    assert.equal(failed.state, 'pending');
    assert.equal(failed.attempts, 1);
    assert.ok(new Date(failed.available_at).getTime() > Date.now());
  } finally {
    cleanup();
  }
});

test('exponential backoff uses base^attempts seconds', { skip: skipWithoutDependencies }, () => {
  const { db, cleanup } = createTempDatabase();
  const QueueService = require('../src/services/queueService');

  try {
    const queue = new QueueService(db);
    queue.enqueue({ id: 'backoff-test', command: 'exit 1', max_retries: 5 });
    const claimed = queue.getPendingJob();
    const before = Date.now();
    const retried = queue.retryJob(claimed.id, 3);
    const delayMs = new Date(retried.available_at).getTime() - before;

    assert.equal(retried.state, 'pending');
    assert.ok(delayMs >= 2900 && delayMs <= 3500, `expected roughly 3 seconds, got ${delayMs}ms`);
  } finally {
    cleanup();
  }
});

test('job moves to DLQ when attempts reach max retries', { skip: skipWithoutDependencies }, async () => {
  const { db, cleanup } = createTempDatabase();
  const QueueService = require('../src/services/queueService');
  const WorkerEngine = require('../src/workers/workerEngine');

  try {
    const queue = new QueueService(db);
    queue.enqueue({ id: 'dlq-test', command: 'exit 1', max_retries: 1 });
    const engine = new WorkerEngine(db, { count: 1, pollIntervalMs: 1 });
    engine.runShellCommand = async () => ({ exitCode: 1 });

    const job = queue.getPendingJob();
    await engine.executeJob(1, job);

    assert.equal(queue.getJob('dlq-test').state, 'dead');
    assert.deepEqual(queue.listJobs('dead').map((deadJob) => deadJob.id), ['dlq-test']);
  } finally {
    cleanup();
  }
});

test('dead-letter job can be retried', { skip: skipWithoutDependencies }, () => {
  const { db, cleanup } = createTempDatabase();
  const QueueService = require('../src/services/queueService');

  try {
    const queue = new QueueService(db);
    queue.enqueue({ id: 'dlq-retry-test', command: 'exit 1', max_retries: 1 });
    queue.getPendingJob();
    queue.retryJob('dlq-retry-test');

    const retried = queue.retryDeadJob('dlq-retry-test');
    assert.equal(retried.state, 'pending');
  } finally {
    cleanup();
  }
});

test('jobs persist after database restart', { skip: skipWithoutDependencies }, () => {
  const { createDatabase } = require('../src/db');
  const QueueService = require('../src/services/queueService');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'queuectl-persist-'));
  const databasePath = path.join(directory, 'queuectl.sqlite');

  try {
    const firstDb = createDatabase(databasePath);
    new QueueService(firstDb).enqueue({ id: 'persist-test', command: 'echo persisted' });
    firstDb.close();

    const secondDb = createDatabase(databasePath);
    const persisted = new QueueService(secondDb).getJob('persist-test');
    secondDb.close();

    assert.equal(persisted.id, 'persist-test');
    assert.equal(persisted.state, 'pending');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('multiple workers do not process the same job twice', { skip: skipWithoutDependencies }, async () => {
  const { db, cleanup } = createTempDatabase();
  const QueueService = require('../src/services/queueService');
  const WorkerEngine = require('../src/workers/workerEngine');

  try {
    const queue = new QueueService(db);
    for (let index = 0; index < 10; index += 1) {
      queue.enqueue({ id: `multi-${index}`, command: 'echo multi', max_retries: 1 });
    }

    const processed = [];
    const engine = new WorkerEngine(db, { count: 4, pollIntervalMs: 1 });
    engine.runShellCommand = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { exitCode: 0 };
    };
    const originalExecuteJob = engine.executeJob.bind(engine);
    engine.executeJob = async (workerId, job) => {
      processed.push(job.id);
      await originalExecuteJob(workerId, job);
      if (queue.getStatus().completed === 10) {
        engine.isStopping = true;
      }
    };

    await engine.start();

    assert.equal(processed.length, 10);
    assert.equal(new Set(processed).size, 10);
    assert.equal(queue.getStatus().completed, 10);
  } finally {
    cleanup();
  }
});
