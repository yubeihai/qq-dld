const { getDb, toObjects, toObject } = require('../connection');

const taskTypes = {
  getAll: () => {
    const db = getDb();
    const result = db.exec('SELECT * FROM task_types ORDER BY name');
    return toObjects(result);
  },

  getById: (id) => {
    const db = getDb();
    const result = db.exec('SELECT * FROM task_types WHERE id = ?', [id]);
    return toObject(result);
  },

  upsert: (id, name, description = '') => {
    const db = getDb();
    db.run(`
      INSERT INTO task_types (id, name, description)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description
    `, [id, name, description]);
  },

  upsertBatch: (tasks) => {
    const db = getDb();
    for (const task of tasks) {
      db.run(`
        INSERT INTO task_types (id, name)
        VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name
      `, [task.id, task.name]);
    }
  },

  delete: (id) => {
    const db = getDb();
    db.run('DELETE FROM task_types WHERE id = ?', [id]);
  },

  clear: () => {
    const db = getDb();
    db.run('DELETE FROM task_types');
  },
};

const taskConfigs = {
  getAll: () => {
    const db = getDb();
    const result = db.exec(`
      SELECT tc.*, tt.name as task_name
      FROM task_configs tc
      LEFT JOIN task_types tt ON tc.task_id = tt.id
      ORDER BY tt.name
    `);
    return toObjects(result);
  },

  getByTaskId: (taskId) => {
    const db = getDb();
    const result = db.exec('SELECT * FROM task_configs WHERE task_id = ?', [taskId]);
    return toObject(result);
  },

  upsert: (taskId, actionType, actionModule = '') => {
    const db = getDb();
    db.run(`
      INSERT INTO task_configs (task_id, action_type, action_module)
      VALUES (?, ?, ?)
      ON CONFLICT(task_id) DO UPDATE SET
        action_type = excluded.action_type,
        action_module = excluded.action_module,
        updated_at = datetime('now', 'localtime')
    `, [String(taskId), actionType, actionModule || '']);
  },

  upsertBatch: (configs) => {
    const db = getDb();
    for (const config of configs) {
      db.run(`
        INSERT INTO task_configs (task_id, action_type, action_module)
        VALUES (?, ?, ?)
        ON CONFLICT(task_id) DO UPDATE SET
          action_type = excluded.action_type,
          action_module = excluded.action_module,
          updated_at = datetime('now', 'localtime')
      `, [String(config.task_id), config.action_type, config.action_module || '']);
    }
  },

  delete: (taskId) => {
    const db = getDb();
    db.run('DELETE FROM task_configs WHERE task_id = ?', [taskId]);
  },

  clear: () => {
    const db = getDb();
    db.run('DELETE FROM task_configs');
  },
};

module.exports = { taskTypes, taskConfigs };
