const { getDb, toObjects, toObject } = require('../connection');

const exchangeTypes = {
  getAll: () => {
    const db = getDb();
    const result = db.exec('SELECT * FROM exchange_types ORDER BY give_item, get_item');
    return toObjects(result);
  },

  getById: (id) => {
    const db = getDb();
    const result = db.exec('SELECT * FROM exchange_types WHERE id = ?', [id]);
    return toObject(result);
  },

  findByItems: (giveItem, getItem) => {
    const db = getDb();
    const result = db.exec('SELECT * FROM exchange_types WHERE give_item = ? AND get_item = ?', [giveItem, getItem]);
    return toObject(result);
  },

  upsert: (id, giveItem, giveCount, getItem, getCount) => {
    const db = getDb();
    db.run(`
      INSERT INTO exchange_types (id, give_item, give_count, get_item, get_count)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET give_item = excluded.give_item, give_count = excluded.give_count, get_item = excluded.get_item, get_count = excluded.get_count
    `, [id, giveItem, giveCount, getItem, getCount]);
  },

  delete: (id) => {
    const db = getDb();
    db.run('DELETE FROM exchange_types WHERE id = ?', [id]);
  },

  clear: () => {
    const db = getDb();
    db.run('DELETE FROM exchange_types');
  },
};

const exchangeConfigs = {
  getAll: () => {
    const db = getDb();
    const result = db.exec(`
      SELECT ec.*, et.give_item, et.give_count, et.get_item, et.get_count
      FROM exchange_configs ec
      LEFT JOIN exchange_types et ON ec.exchange_id = et.id
      ORDER BY et.give_item, et.get_item
    `);
    return toObjects(result);
  },

  getById: (id) => {
    const db = getDb();
    const result = db.exec('SELECT * FROM exchange_configs WHERE exchange_id = ?', [id]);
    return toObject(result);
  },

  getAction: (id) => {
    const config = exchangeConfigs.getById(id);
    return config ? config.action : 'reject';
  },

  shouldAccept: (id) => {
    const config = exchangeConfigs.getById(id);
    return config ? config.action === 'accept' : false;
  },

  upsert: (id, action = 'reject') => {
    const db = getDb();
    db.run(`
      INSERT INTO exchange_configs (exchange_id, action)
      VALUES (?, ?)
      ON CONFLICT(exchange_id) DO UPDATE SET action = excluded.action, updated_at = datetime('now', 'localtime')
    `, [id, action]);
  },

  upsertBatch: (configs) => {
    const db = getDb();
    for (const c of configs) {
      db.run(`
        INSERT INTO exchange_configs (exchange_id, action)
        VALUES (?, ?)
        ON CONFLICT(exchange_id) DO UPDATE SET action = excluded.action, updated_at = datetime('now', 'localtime')
      `, [c.id, c.action || 'reject']);
    }
  },

  delete: (id) => {
    const db = getDb();
    db.run('DELETE FROM exchange_configs WHERE exchange_id = ?', [id]);
  },

  clear: () => {
    const db = getDb();
    db.run('DELETE FROM exchange_configs');
  },
};

module.exports = { exchangeTypes, exchangeConfigs };
