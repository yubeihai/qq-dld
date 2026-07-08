const { getDb, toObjects, toObject } = require('../connection');

const moduleConfigs = {
  getAll: () => {
    const db = getDb();
    const result = db.exec('SELECT * FROM module_configs');
    return toObjects(result);
  },

  getById: (id) => {
    const db = getDb();
    const result = db.exec('SELECT * FROM module_configs WHERE id = ?', [id]);
    return toObject(result);
  },

  update: (id, data) => {
    const db = getDb();
    const fields = [];
    const values = [];
    Object.keys(data).forEach(key => {
      fields.push(`${key} = ?`);
      values.push(data[key]);
    });
    if (fields.length === 0) return;
    values.push(id);
    db.run(`UPDATE module_configs SET ${fields.join(', ')}, updated_at = datetime('now', 'localtime') WHERE id = ?`, values);
  },

  upsert: (id, name, category, description) => {
    const db = getDb();
    db.run(`
      INSERT INTO module_configs (id, name, category, description, cmd)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, category = excluded.category, description = excluded.description
    `, [id, name, category, description, id]);
  },

  getEnabledAutoModules: () => {
    const db = getDb();
    const result = db.exec('SELECT * FROM module_configs WHERE auto_enabled = 1');
    return toObjects(result);
  },

  reset: () => {
    const db = getDb();
    db.run('DELETE FROM module_configs');
  },
};

module.exports = { moduleConfigs };
