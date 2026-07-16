function format(level, message, metadata) {
  const timestamp = new Date().toISOString();
  const suffix = metadata === undefined ? '' : ` ${JSON.stringify(metadata)}`;
  return `[${timestamp}] ${level.toUpperCase()} ${message}${suffix}\n`;
}

function write(stream, level, message, metadata) {
  stream.write(format(level, message, metadata));
}

module.exports = {
  debug(message, metadata) {
    if (process.env.QUEUECTL_LOG_LEVEL === 'debug') {
      write(process.stderr, 'debug', message, metadata);
    }
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
