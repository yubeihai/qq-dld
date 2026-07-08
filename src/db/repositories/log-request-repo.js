const { getDb, toObjects } = require('../connection');

const logRequests = {
  add: (data) => {
    const db = getDb();
    db.run(`
      INSERT INTO log_requests (session_id, cmd, url, status_code, request_size, response_size, duration_ms, retry_count, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.session_id,
      data.cmd,
      data.url || '',
      data.status_code || 0,
      data.request_size || 0,
      data.response_size || 0,
      data.duration_ms || 0,
      data.retry_count || 0,
      data.error || '',
    ]);
  },

  findBySession: (sessionId) => {
    const db = getDb();
    const result = db.exec(
      `SELECT * FROM log_requests WHERE session_id = ? ORDER BY created_at ASC`,
      [sessionId]
    );
    return toObjects(result);
  },

  clearOld: (days = 7) => {
    const db = getDb();
    db.run(`DELETE FROM log_requests WHERE created_at < datetime('now', '-${days} days')`);
  },
};

module.exports = { logRequests };
