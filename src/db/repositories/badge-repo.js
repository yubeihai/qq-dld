const { getDb, toObjects, toObject } = require('../connection');

const badgeTypes = {
  getAll: () => {
    const db = getDb();
    const result = db.exec('SELECT * FROM badge_types ORDER BY id');
    return toObjects(result);
  },

  getById: (id) => {
    const db = getDb();
    const result = db.exec('SELECT * FROM badge_types WHERE id = ?', [id]);
    return toObject(result);
  },

  upsert: (id, name, rank = '', stage = 0) => {
    const db = getDb();
    db.run(`
      INSERT INTO badge_types (id, name, rank, stage)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, rank = excluded.rank, stage = excluded.stage
    `, [id, name, rank, stage]);
  },

  upsertBatch: (badges) => {
    const db = getDb();
    for (const b of badges) {
      db.run(`
        INSERT INTO badge_types (id, name, rank, stage)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, rank = excluded.rank, stage = excluded.stage
      `, [b.id, b.name, b.rank || '', b.stage || 0]);
    }
  },

  delete: (id) => {
    const db = getDb();
    db.run('DELETE FROM badge_types WHERE id = ?', [id]);
  },

  clear: () => {
    const db = getDb();
    db.run('DELETE FROM badge_types');
  },
};

const badgeConfigs = {
  getAll: () => {
    const db = getDb();
    const result = db.exec(`
      SELECT bc.*, bt.name, bt.rank, bt.stage
      FROM badge_configs bc
      LEFT JOIN badge_types bt ON bc.badge_id = bt.id
      ORDER BY bt.name
    `);
    return toObjects(result);
  },

  getById: (id) => {
    const db = getDb();
    const result = db.exec('SELECT * FROM badge_configs WHERE badge_id = ?', [id]);
    return toObject(result);
  },

  getEnabled: () => {
    const db = getDb();
    const result = db.exec(`
      SELECT bc.*, bt.name, bt.rank, bt.stage
      FROM badge_configs bc
      LEFT JOIN badge_types bt ON bc.badge_id = bt.id
      WHERE bc.enabled = 1
      ORDER BY bt.name
    `);
    return toObjects(result);
  },

  isEnabled: (id) => {
    const config = badgeConfigs.getById(id);
    return config ? config.enabled === 1 : false;
  },

  upsert: (id, enabled = true) => {
    const db = getDb();
    db.run(`
      INSERT INTO badge_configs (badge_id, enabled)
      VALUES (?, ?)
      ON CONFLICT(badge_id) DO UPDATE SET enabled = excluded.enabled, updated_at = datetime('now', 'localtime')
    `, [id, enabled ? 1 : 0]);
  },

  upsertBatch: (configs) => {
    const db = getDb();
    for (const c of configs) {
      db.run(`
        INSERT INTO badge_configs (badge_id, enabled)
        VALUES (?, ?)
        ON CONFLICT(badge_id) DO UPDATE SET enabled = excluded.enabled, updated_at = datetime('now', 'localtime')
      `, [c.id, c.enabled ? 1 : 0]);
    }
  },

  delete: (id) => {
    const db = getDb();
    db.run('DELETE FROM badge_configs WHERE badge_id = ?', [id]);
  },

  clear: () => {
    const db = getDb();
    db.run('DELETE FROM badge_configs');
  },
};

module.exports = { badgeTypes, badgeConfigs };
