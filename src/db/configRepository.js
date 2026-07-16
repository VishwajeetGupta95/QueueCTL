const { nowIso } = require('../utils/time');

class ConfigRepository {
  constructor(db) {
    this.db = db;
  }

  get(key) {
    const row = this.db.prepare('SELECT value FROM config WHERE key = ?').get(key);
    return row ? row.value : undefined;
  }

  set(key, value) {
    const updatedAt = nowIso();
    this.db.prepare(`
      INSERT INTO config (key, value, updated_at)
      VALUES (@key, @value, @updatedAt)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `).run({ key, value: String(value), updatedAt });
  }
}

module.exports = ConfigRepository;
