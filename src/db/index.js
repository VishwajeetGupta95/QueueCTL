const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');
const config = require('../config');
const { initializeSchema } = require('./schema');

let connection;

function ensureDirectory(filePath) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
}

function createDatabase(databasePath = config.databasePath) {
  ensureDirectory(databasePath);
  const db = new Database(databasePath);
  initializeSchema(db);
  return db;
}

function getDatabase() {
  if (!connection) {
    connection = createDatabase();
  }
  return connection;
}

function closeDatabase() {
  if (connection) {
    connection.close();
    connection = undefined;
  }
}

module.exports = {
  closeDatabase,
  createDatabase,
  getDatabase,
};
