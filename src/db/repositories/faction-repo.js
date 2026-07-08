const { getDb, toObjects, toObject } = require('../connection');

const factionTaskTypes = {
  getAll: () => {
    const db = getDb();
    const result = db.exec('SELECT * FROM faction_task_types ORDER BY id');
    return toObjects(result);
  },

  getById: (id) => {
    const db = getDb();
    const result = db.exec('SELECT * FROM faction_task_types WHERE id = ?', [id]);
    return toObject(result);
  },

  upsert: (id, name, description = '') => {
    const db = getDb();
    db.run(`
      INSERT INTO faction_task_types (id, name, description)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description
    `, [id, name, description]);
  },

  upsertBatch: (tasks) => {
    const db = getDb();
    for (const task of tasks) {
      db.run(`
        INSERT INTO faction_task_types (id, name)
        VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name
      `, [task.id, task.name]);
    }
  },

  delete: (id) => {
    const db = getDb();
    db.run('DELETE FROM faction_task_types WHERE id = ?', [id]);
  },

  clear: () => {
    const db = getDb();
    db.run('DELETE FROM faction_task_types');
  },
};

const factionTaskConfigs = {
  getAll: () => {
    const db = getDb();
    const result = db.exec(`
      SELECT fc.*, ft.name as task_name
      FROM faction_task_configs fc
      LEFT JOIN faction_task_types ft ON fc.task_id = ft.id
      ORDER BY ft.name
    `);
    return toObjects(result);
  },

  getByTaskId: (taskId) => {
    const db = getDb();
    const result = db.exec('SELECT * FROM faction_task_configs WHERE task_id = ?', [taskId]);
    return toObject(result);
  },

  upsert: (taskId, actionType, actionModule = '', actionParams = '{}') => {
    const db = getDb();
    db.run(`
      INSERT INTO faction_task_configs (task_id, action_type, action_module, action_params)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(task_id) DO UPDATE SET
        action_type = excluded.action_type,
        action_module = excluded.action_module,
        action_params = excluded.action_params,
        updated_at = datetime('now', 'localtime')
    `, [taskId, actionType, actionModule, actionParams]);
  },

  delete: (taskId) => {
    const db = getDb();
    db.run('DELETE FROM faction_task_configs WHERE task_id = ?', [taskId]);
  },

  clear: () => {
    const db = getDb();
    db.run('DELETE FROM faction_task_configs');
  },
};

module.exports = { factionTaskTypes, factionTaskConfigs };
