function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

module.exports = {
  printJson,
};
