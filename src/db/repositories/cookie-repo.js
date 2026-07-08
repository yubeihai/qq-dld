const { getDb, toObject } = require('../connection');

const cookieRepo = {
  get: () => {
    const db = getDb();
    const result = db.exec('SELECT value FROM cookies WHERE id = 1');
    const rows = result.length > 0 && result[0].values.length > 0
      ? { value: result[0].values[0][0] }
      : null;
    return rows;
  },

  set: (value) => {
    const db = getDb();
    db.run(`
      INSERT INTO cookies (id, value, updated_at)
      VALUES (1, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `, [value]);
  },

  exists: () => {
    const db = getDb();
    const result = db.exec('SELECT 1 FROM cookies WHERE id = 1');
    return result.length > 0 && result[0].values.length > 0;
  },

  clear: () => {
    const db = getDb();
    db.run('DELETE FROM cookies WHERE id = 1');
  },
};

module.exports = { cookieRepo };
