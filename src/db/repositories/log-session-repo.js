const { getDb, toObjects, toObject } = require('../connection');

const logSessions = {
  create: (data) => {
    const db = getDb();
    const {
      id, module_id, module_name, source = 'manual',
      params = '{}',
    } = data;
    db.run(`
      INSERT INTO log_sessions (id, module_id, module_name, source, params)
      VALUES (?, ?, ?, ?, ?)
    `, [id, module_id, module_name, source, params]);
  },

  findById: (id) => {
    const db = getDb();
    const result = db.exec(`SELECT * FROM log_sessions WHERE id = ?`, [id]);
    return toObject(result);
  },

  findAll: (filters = {}, limit = 50, offset = 0) => {
    const db = getDb();
    let sql = 'SELECT * FROM log_sessions';
    const params = [];
    const conditions = [];

    if (filters.module_id) {
      conditions.push('module_id = ?');
      params.push(filters.module_id);
    }
    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters.date) {
      conditions.push("date(created_at) = '" + filters.date + "'");
    }
    if (filters.source) {
      conditions.push('source = ?');
      params.push(filters.source);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY created_at DESC';
    const safeLimit = Math.max(1, parseInt(limit) || 50);
    const safeOffset = Math.max(0, parseInt(offset) || 0);
    sql += ` LIMIT ${safeLimit} OFFSET ${safeOffset}`;

    const result = db.exec(sql, params);
    return toObjects(result);
  },

  count: (filters = {}) => {
    const db = getDb();
    let sql = 'SELECT COUNT(*) as total FROM log_sessions';
    const params = [];
    const conditions = [];

    if (filters.module_id) {
      conditions.push('module_id = ?');
      params.push(filters.module_id);
    }
    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters.date) {
      conditions.push("date(created_at) = '" + filters.date + "'");
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    const result = db.exec(sql, params);
    const rows = toObjects(result);
    return rows.length > 0 ? rows[0].total : 0;
  },

  update: (id, data) => {
    const db = getDb();
    const fields = [];
    const values = [];

    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.summary !== undefined) {
      fields.push('summary = ?');
      values.push(data.summary);
    }
    if (data.ended_at !== undefined) {
      fields.push('ended_at = ?');
      values.push(data.ended_at);
    }
    if (data.duration_ms !== undefined) {
      fields.push('duration_ms = ?');
      values.push(data.duration_ms);
    }

    if (fields.length === 0) return;
    values.push(id);

    db.run(`UPDATE log_sessions SET ${fields.join(', ')} WHERE id = ?`, values);
  },

  incrementRequestCount: (id) => {
    const db = getDb();
    db.run('UPDATE log_sessions SET request_count = request_count + 1 WHERE id = ?', [id]);
  },

  clear: () => {
    const db = getDb();
    db.run('DELETE FROM log_sessions');
  },

  clearOld: (days = 90) => {
    const db = getDb();
    db.run(`DELETE FROM log_sessions WHERE created_at < datetime('now', '-${days} days')`);
  },

  getStats: (date) => {
    const db = getDb();
    const where = date ? `WHERE date(created_at) = '${date}'` : '';
    const params = date ? [] : [];

    const totalResult = db.exec(`SELECT COUNT(*) as total FROM log_sessions ${where}`, params);
    const successResult = db.exec(`SELECT COUNT(*) as total FROM log_sessions ${where} ${where ? 'AND' : 'WHERE'} status = 'success'`, params);
    const avgResult = db.exec(`SELECT AVG(duration_ms) as avg_duration, SUM(request_count) as total_requests FROM log_sessions ${where}`, params);

    const byModuleResult = db.exec(`
      SELECT module_id, module_name,
             COUNT(*) as sessions,
             SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM log_sessions
      ${where}
      GROUP BY module_id
      ORDER BY sessions DESC
    `, params);

    const total = toObjects(totalResult)[0]?.total || 0;
    const success = toObjects(successResult)[0]?.total || 0;
    const avgData = toObjects(avgResult)[0] || {};

    return {
      total_sessions: total,
      success_sessions: success,
      success_rate: total > 0 ? Math.round((success / total) * 100) / 100 : 0,
      avg_duration_ms: Math.round(avgData.avg_duration || 0),
      total_requests: avgData.total_requests || 0,
      by_module: toObjects(byModuleResult),
    };
  },
};

module.exports = { logSessions };
