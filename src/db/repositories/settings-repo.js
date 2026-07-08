const { getDb, toObjects, toObject } = require('../connection');

const settings = {
  get: (key, defaultValue = null) => {
    const db = getDb();
    const result = db.exec('SELECT value FROM settings WHERE key = ?', [key]);
    const row = toObject(result);
    if (row && row.value !== null) {
      try {
        return JSON.parse(row.value);
      } catch {
        return row.value;
      }
    }
    return defaultValue;
  },

  set: (key, value) => {
    const db = getDb();
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    db.run(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [key, valueStr]);
  },

  delete: (key) => {
    const db = getDb();
    db.run('DELETE FROM settings WHERE key = ?', [key]);
  },
};

module.exports = { settings };
