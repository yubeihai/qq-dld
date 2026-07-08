const { getDb, toObjects, toObject } = require('../connection');

const friendRepo = {
  getAll: () => {
    const db = getDb();
    const result = db.exec('SELECT * FROM friends ORDER BY type, name');
    return toObjects(result);
  },

  getEnabled: () => {
    const db = getDb();
    const result = db.exec('SELECT * FROM friends WHERE enabled = 1 ORDER BY type, name');
    return toObjects(result);
  },

  getByUid: (uid) => {
    const db = getDb();
    const result = db.exec('SELECT * FROM friends WHERE uid = ?', [uid]);
    return toObject(result);
  },

  upsert: (uid, name, type = 'friend', enabled = true) => {
    const db = getDb();
    db.run(`
      INSERT INTO friends (uid, name, type, enabled)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(uid) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        enabled = excluded.enabled,
        updated_at = datetime('now', 'localtime')
    `, [uid, name, type, enabled ? 1 : 0]);
  },

  upsertBatch: (friendsList) => {
    const db = getDb();
    for (const f of friendsList) {
      db.run(`
        INSERT INTO friends (uid, name, type, enabled)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(uid) DO UPDATE SET
          name = excluded.name,
          type = excluded.type,
          updated_at = datetime('now', 'localtime')
      `, [f.uid, f.name, f.type || 'friend', f.enabled !== false ? 1 : 0]);
    }
  },

  setEnabled: (uid, enabled) => {
    const db = getDb();
    db.run('UPDATE friends SET enabled = ?, updated_at = datetime(\'now\', \'localtime\') WHERE uid = ?', [enabled ? 1 : 0, uid]);
  },

  setEnabledBatch: (uids, enabled) => {
    const db = getDb();
    for (const uid of uids) {
      db.run('UPDATE friends SET enabled = ?, updated_at = datetime(\'now\', \'localtime\') WHERE uid = ?', [enabled ? 1 : 0, uid]);
    }
  },

  delete: (uid) => {
    const db = getDb();
    db.run('DELETE FROM friends WHERE uid = ?', [uid]);
  },

  clear: () => {
    const db = getDb();
    db.run('DELETE FROM friends');
  },
};

module.exports = { friendRepo };
