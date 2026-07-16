const { spawn } = require('node:child_process');

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: 'pipe',
      ...options,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
  });
}

module.exports = {
  runCommand,
};
