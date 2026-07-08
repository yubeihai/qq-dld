const { getDb, toObjects, toObject } = require('../connection');

const execLogs = {
  add: (moduleId, moduleName, command, result, status = 'success') => {
    const db = getDb();
    db.run(`
      INSERT INTO exec_logs (module_id, module_name, command, result, status)
      VALUES (?, ?, ?, ?, ?)
    `, [moduleId, moduleName, command, result, status]);
  },

  getByDate: (date) => {
    const db = getDb();
    const result = db.exec(
      `SELECT * FROM exec_logs WHERE date(created_at) = date(?) ORDER BY created_at DESC`,
      [date]
    );
    return toObjects(result);
  },

  getByModuleId: (moduleId, limit = 20) => {
    const db = getDb();
    const result = db.exec(
      `SELECT * FROM exec_logs WHERE module_id = ? ORDER BY created_at DESC LIMIT ?`,
      [moduleId, limit]
    );
    return toObjects(result);
  },

  getAll: (limit = 50) => {
    const db = getDb();
    const result = db.exec(`SELECT * FROM exec_logs ORDER BY created_at DESC LIMIT ?`, [limit]);
    return toObjects(result);
  },

  clear: () => {
    const db = getDb();
    db.run('DELETE FROM exec_logs');
  },
};

module.exports = { execLogs };
