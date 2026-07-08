const { getDb, toObjects } = require('../connection');

const logSteps = {
  add: (data) => {
    const db = getDb();
    db.run(`
      INSERT INTO log_steps (session_id, seq, action, target, status, detail, error, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.session_id,
      data.seq,
      data.action,
      data.target || '',
      data.status || 'success',
      typeof data.detail === 'object' ? JSON.stringify(data.detail) : (data.detail || '{}'),
      data.error || '',
      data.duration_ms || 0,
    ]);
  },

  findBySession: (sessionId) => {
    const db = getDb();
    const result = db.exec(
      `SELECT * FROM log_steps WHERE session_id = ? ORDER BY seq ASC`,
      [sessionId]
    );
    return toObjects(result).map(row => {
      try {
        row.detail = JSON.parse(row.detail || '{}');
      } catch {
        row.detail = {};
      }
      return row;
    });
  },

  clearOld: (days = 30) => {
    const db = getDb();
    db.run(`DELETE FROM log_steps WHERE created_at < datetime('now', '-${days} days')`);
  },
};

module.exports = { logSteps };
