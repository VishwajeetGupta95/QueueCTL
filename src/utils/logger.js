const LEVELS = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
});

function getConfiguredLevel() {
  const configured = process.env.QUEUECTL_LOG_LEVEL || 'info';
  return LEVELS[configured] === undefined ? 'info' : configured;
}

function shouldLog(level) {
  return LEVELS[level] >= LEVELS[getConfiguredLevel()];
}

function format(level, message, metadata) {
  const timestamp = new Date().toISOString();
  const suffix = metadata === undefined ? '' : ` ${JSON.stringify(metadata)}`;
  return `[${timestamp}] ${level.toUpperCase()} ${message}${suffix}\n`;
}

function write(stream, level, message, metadata) {
  if (shouldLog(level)) {
    stream.write(format(level, message, metadata));
  }
}

module.exports = {
  debug(message, metadata) {
    write(process.stderr, 'debug', message, metadata);
  },
  info(message, metadata) {
    write(process.stderr, 'info', message, metadata);
  },
  warn(message, metadata) {
    write(process.stderr, 'warn', message, metadata);
  },
  error(message, metadata) {
    write(process.stderr, 'error', message, metadata);
  },
};
