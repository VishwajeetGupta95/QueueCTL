# queuectl

`queuectl` is a production-oriented Node.js CLI job queue foundation. It persists jobs in SQLite, executes shell commands with worker processes, retries failures with exponential backoff, and exposes queue operations through a small CLI.

## Installation

```bash
npm install
npm link # optional, exposes the queuectl binary locally
```

Create a local environment file if you want to override defaults:

```bash
cp .env.example .env
```

Common settings:

```dotenv
QUEUECTL_DB_PATH=./queuectl.sqlite
QUEUECTL_DEFAULT_MAX_RETRIES=3
QUEUECTL_DEFAULT_BACKOFF_BASE=2
QUEUECTL_WORKER_POLL_INTERVAL_MS=1000
QUEUECTL_LOG_LEVEL=info
```

## Architecture

The project uses CommonJS JavaScript with clear runtime boundaries:

- **CLI layer**: `commander` command registration and process-level error handling.
- **Service layer**: queue and configuration business logic.
- **Persistence layer**: `better-sqlite3` connection management, schema creation, and repositories.
- **Worker layer**: long-running polling workers that claim and execute jobs.
- **Utilities**: logging, output formatting, time helpers, and typed application errors.

Jobs are claimed by transitioning from `pending` to `processing` in a SQLite transaction. Attempts are incremented when a worker claims a job, so a failed execution can decide whether to retry or move to the DLQ based on the updated attempt count.

## Folder structure

```text
src/
  cli/          CLI entrypoint
  commands/     Commander command modules
  config/       Environment-backed runtime defaults
  db/           SQLite connection, schema, and repositories
  queue/        Queue states and validation
  services/     Queue and config services
  utils/        Logger, output, errors, time, command runner
  workers/      Worker engine

test/           Node test runner integration tests
```

## Database schema

`jobs` table:

| Column | Type | Description |
| --- | --- | --- |
| `id` | `TEXT PRIMARY KEY` | Caller-provided or generated job id |
| `command` | `TEXT NOT NULL` | Shell command string or serialized command array |
| `state` | `TEXT NOT NULL` | `pending`, `processing`, `completed`, `failed`, or `dead` |
| `attempts` | `INTEGER NOT NULL` | Incremented when a worker claims a job |
| `max_retries` | `INTEGER NOT NULL` | Maximum attempts before DLQ |
| `created_at` | `TEXT NOT NULL` | ISO timestamp |
| `updated_at` | `TEXT NOT NULL` | ISO timestamp |
| `available_at` | `TEXT NOT NULL` | ISO timestamp used for scheduled jobs and retry backoff |

`config` table:

| Column | Type | Description |
| --- | --- | --- |
| `key` | `TEXT PRIMARY KEY` | Configuration key |
| `value` | `TEXT NOT NULL` | Stored value |
| `updated_at` | `TEXT NOT NULL` | ISO timestamp |

## CLI commands

```bash
queuectl enqueue '<json>'
queuectl list [--state pending|processing|completed|failed|dead]
queuectl status
queuectl worker start --count N
queuectl worker stop
queuectl config set max-retries VALUE
queuectl config set backoff-base VALUE
queuectl dlq list
queuectl dlq retry <jobId>
```

## Usage examples

Enqueue a job:

```bash
queuectl enqueue '{"id":"hello","command":"echo hello"}'
```

Enqueue a scheduled job using `available_at`:

```bash
queuectl enqueue '{"id":"later","command":"echo later","available_at":"2030-01-01T00:00:00Z"}'
```

Start four worker loops in the current process:

```bash
queuectl worker start --count 4
```

Request graceful worker shutdown:

```bash
queuectl worker stop
```

Inspect queue state:

```bash
queuectl status
queuectl list --state pending
```

## Retry flow

1. A worker claims a pending job and increments `attempts`.
2. The command exits with a non-zero code or fails to start.
3. If `attempts < max_retries`, the job is moved back to `pending`.
4. `available_at` is set to `now + backoff-base ^ attempts` seconds.
5. The job becomes eligible again once `available_at` is in the past.

Example with `backoff-base = 2`:

| Attempt | Delay |
| --- | --- |
| 1 | 2 seconds |
| 2 | 4 seconds |
| 3 | 8 seconds |

## DLQ flow

When a failed job has `attempts >= max_retries`, it is moved to the `dead` state.

List DLQ jobs:

```bash
queuectl dlq list
```

Retry a DLQ job:

```bash
queuectl dlq retry hello
```

Retrying a DLQ job moves it back to `pending` immediately. It preserves the original attempt count, which keeps retry history visible.

## Worker lifecycle

Workers continuously poll for jobs until one of the following happens:

- `queuectl worker stop` stores a shutdown request in SQLite.
- The process receives `SIGINT`.
- The process receives `SIGTERM`.

Shutdown is graceful: workers stop claiming new jobs, but current jobs are allowed to finish before the process exits.

## Configuration

Configuration is stored in SQLite so worker and CLI processes share the same values.

Set default max retries for newly enqueued jobs:

```bash
queuectl config set max-retries 5
```

Set retry backoff base:

```bash
queuectl config set backoff-base 3
```

Environment variables provide startup defaults when config values are not present in SQLite.

## Testing

Run tests with:

```bash
npm test
```

The test suite covers:

- Enqueue
- Successful job execution
- Failed job retry
- Exponential backoff
- DLQ movement
- DLQ retry
- Persistence after restart
- Multiple workers without duplicate execution

## Assignment checklist

- ✓ Persistent storage
- ✓ Multiple workers
- ✓ Retry with exponential backoff
- ✓ Dead Letter Queue
- ✓ Graceful shutdown
- ✓ Configuration management
- ✓ Status command
- ✓ List command
- ✓ Clean architecture

## Assumptions

- Jobs execute shell commands on the same host as the worker process.
- SQLite is sufficient for local durable queue semantics and lightweight multi-process coordination.
- Job output streams to the worker process stdio for now.
- `available_at` handles both scheduled jobs and retry delays.

## Trade-offs

- SQLite keeps deployment simple, but it is not intended to replace a distributed queue for very high throughput workloads.
- The worker engine uses polling instead of notifications, which is simple and reliable but introduces a small configurable delay.
- Attempts increment when a job is claimed, not after it fails. This makes retry and DLQ decisions deterministic after each execution.
- DLQ retry preserves attempt count to keep history visible; operators can enqueue a new job if they want a clean retry budget.
