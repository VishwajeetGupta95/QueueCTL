# QueueCTL

QueueCTL is a lightweight, production-style CLI job queue built with Node.js and SQLite. It lets you enqueue jobs, run multiple workers, retry failed jobs with exponential backoff, and move permanently failed jobs to a Dead Letter Queue (DLQ).

It is designed for local development, small deployments, and demos where a full message broker is unnecessary.

## Features

- Enqueue jobs from the command line
- Persist jobs in SQLite across process restarts
- Run multiple worker processes in parallel
- Prevent duplicate processing of the same job
- Retry failed jobs automatically with exponential backoff
- Move exhausted retries to a DLQ
- Support graceful worker shutdown
- Configure retry defaults and backoff via CLI
- Provide a simple CLI interface with helpful help text

## Tech Stack

- Node.js
- SQLite via better-sqlite3
- Commander.js for CLI parsing

## Installation

Clone the repository and install dependencies:

```bash
git clone <your-repo-url>
cd QueueCTL
npm install
```

Optional: expose the CLI globally so you can run `queuectl` from anywhere:

```bash
npm link
```

If you want to override defaults, create a local environment file:

```bash
cp .env.example .env
```

Example environment values:

```dotenv
QUEUECTL_DB_PATH=./queuectl.sqlite
QUEUECTL_DEFAULT_MAX_RETRIES=3
QUEUECTL_DEFAULT_BACKOFF_BASE=2
QUEUECTL_WORKER_POLL_INTERVAL_MS=1000
QUEUECTL_LOG_LEVEL=info
```

## Project Structure

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

## CLI Commands

### 1. Enqueue a job

```bash
queuectl enqueue '{"id":"job1","command":"echo hello"}'
```

You can also provide optional fields such as `max_retries`, `available_at`, or a custom id:

```bash
queuectl enqueue '{"id":"job2","command":"sleep 2","max_retries":5}'
```

### 2. Start workers

Start one worker:

```bash
queuectl worker start
```

Start multiple workers:

```bash
queuectl worker start --count 3
```

Start workers and stop automatically when the queue is empty:

```bash
queuectl worker start --count 1 --once
```

### 3. Stop workers gracefully

```bash
queuectl worker stop
```

### 4. View queue status

Show counts by state:

```bash
queuectl status
```

List jobs:

```bash
queuectl list
```

List jobs by state:

```bash
queuectl list --state pending
queuectl list --state completed
queuectl list --state dead
```

### 5. Manage configuration

Set the default max retries for new jobs:

```bash
queuectl config set max-retries 5
```

Set the backoff base:

```bash
queuectl config set backoff-base 3
```

### 6. Dead Letter Queue (DLQ)

List dead-letter jobs:

```bash
queuectl dlq list
```

Retry a dead-letter job:

```bash
queuectl dlq retry job1
```

## Usage with npm

You can run the CLI with `npm start` as well:

```bash
npm start
```

To pass a command through `npm start`, use `--`:

```bash
npm start -- enqueue '{"id":"job1","command":"echo hi"}'
npm start -- worker start --count 2
npm start -- worker start --once
```

## Quick Dummy Commands

These commands are useful for smoke testing the application.

### Enqueue examples

```bash
node src/cli/index.js enqueue '{"id":"job-echo","command":"echo hello"}'
node src/cli/index.js enqueue '{"id":"job-sleep","command":"sleep 2"}'
node src/cli/index.js enqueue '{"id":"job-fail","command":"exit 1"}'
node src/cli/index.js enqueue '{"id":"job-bad","command":"nonexistentcmd"}'
```

### Worker examples

```bash
node src/cli/index.js worker start --count 3
node src/cli/index.js worker start --count 1 --once
node src/cli/index.js worker stop
```

### Status and inspection examples

```bash
node src/cli/index.js status
node src/cli/index.js list --state pending
node src/cli/index.js dlq list
```

### Config examples

```bash
node src/cli/index.js config set max-retries 5
node src/cli/index.js config set backoff-base 3
```

## Job Lifecycle

Each job moves through the following states:

- `pending`: waiting to be picked up by a worker
- `processing`: currently being executed
- `completed`: executed successfully
- `failed`: failed but can still be retried
- `dead`: moved to the DLQ after retries are exhausted

## Retry and Backoff Behavior

When a job fails:

1. The worker increments the job attempt count.
2. If the job has remaining retry budget, it is moved back to `pending`.
3. The `available_at` timestamp is updated using exponential backoff.
4. The delay is calculated as:

```text
delay = backoff-base ^ attempts
```

Example with `backoff-base = 2`:

| Attempt | Delay |
| --- | --- |
| 1 | 2 seconds |
| 2 | 4 seconds |
| 3 | 8 seconds |

If the retry budget is exhausted, the job is moved to the DLQ.

## Persistence

QueueCTL stores job state and configuration in SQLite. This means jobs survive process restarts and remain available for future workers.

## Worker Lifecycle

Workers keep polling for pending jobs until one of the following happens:

- A worker stop request is issued via `queuectl worker stop`
- The process receives `SIGINT` or `SIGTERM`
- The worker is launched with `--once` and the queue is empty

## Testing

Run the test suite:

```bash
npm test
```

The test suite covers:

- Enqueue behavior
- Successful job execution
- Failed job retry
- Backoff behavior
- DLQ movement
- DLQ retry
- Persistence across restarts
- Multiple workers without duplicate execution

## Assumptions and Trade-offs

- Jobs run on the same host as the worker process.
- SQLite is used for simplicity and durability in a local or small-scale environment.
- The worker approach uses polling rather than event-driven notifications.
- This project focuses on correctness and clarity over high-throughput distributed queue semantics.

## Troubleshooting

### Command not found

If `queuectl` is not recognized, try:

```bash
npm link
```

Then verify:

```bash
queuectl --help
```

### JSON quoting errors

On Linux/macOS shells, wrap JSON in single quotes:

```bash
queuectl enqueue '{"id":"job1","command":"echo hi"}'
```

On Windows PowerShell, use double quotes and escape inner quotes accordingly.

## License

MIT
