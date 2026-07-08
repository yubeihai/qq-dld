const { getDb, toObjects, toObject } = require('../connection');

const knightMissionTypes = {
  getAll: () => {
    const db = getDb();
    const result = db.exec('SELECT * FROM knight_mission_types ORDER BY name');
    return toObjects(result);
  },

  getByName: (name) => {
    const db = getDb();
    const result = db.exec('SELECT * FROM knight_mission_types WHERE name = ?', [name]);
    return toObject(result);
  },

  upsert: (name, reward = '', duration = 0) => {
    const db = getDb();
    db.run(`
      INSERT INTO knight_mission_types (name, reward, duration)
      VALUES (?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET reward = excluded.reward, duration = excluded.duration
    `, [name, reward, duration]);
  },

  upsertBatch: (missions) => {
    const db = getDb();
    for (const m of missions) {
      db.run(`
        INSERT INTO knight_mission_types (name, reward, duration)
        VALUES (?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET reward = excluded.reward, duration = excluded.duration
      `, [m.name, m.reward || '', m.duration || 0]);
    }
  },

  delete: (name) => {
    const db = getDb();
    db.run('DELETE FROM knight_mission_types WHERE name = ?', [name]);
  },

  clear: () => {
    const db = getDb();
    db.run('DELETE FROM knight_mission_types');
  },
};

const knightMissionConfigs = {
  getAll: () => {
    const db = getDb();
    const result = db.exec(`
      SELECT mc.*, mt.reward, mt.duration
      FROM knight_mission_configs mc
      LEFT JOIN knight_mission_types mt ON mc.mission_name = mt.name
      ORDER BY mc.mission_name
    `);
    return toObjects(result);
  },

  getByName: (name) => {
    const db = getDb();
    const result = db.exec('SELECT * FROM knight_mission_configs WHERE mission_name = ?', [name]);
    return toObject(result);
  },

  isEnabled: (name) => {
    const config = knightMissionConfigs.getByName(name);
    return config ? config.enabled === 1 : true;
  },

  upsert: (name, enabled = true) => {
    const db = getDb();
    db.run(`
      INSERT INTO knight_mission_configs (mission_name, enabled)
      VALUES (?, ?)
      ON CONFLICT(mission_name) DO UPDATE SET enabled = excluded.enabled, updated_at = datetime('now', 'localtime')
    `, [name, enabled ? 1 : 0]);
  },

  upsertBatch: (configs) => {
    const db = getDb();
    for (const c of configs) {
      db.run(`
        INSERT INTO knight_mission_configs (mission_name, enabled)
        VALUES (?, ?)
        ON CONFLICT(mission_name) DO UPDATE SET enabled = excluded.enabled, updated_at = datetime('now', 'localtime')
      `, [c.name, c.enabled ? 1 : 0]);
    }
  },

  delete: (name) => {
    const db = getDb();
    db.run('DELETE FROM knight_mission_configs WHERE mission_name = ?', [name]);
  },

  clear: () => {
    const db = getDb();
    db.run('DELETE FROM knight_mission_configs');
  },
};

module.exports = { knightMissionTypes, knightMissionConfigs };
