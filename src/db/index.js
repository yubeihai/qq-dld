const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'data', 'database.sqlite');

let db = null;

async function initDb() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
    migrateDb();
  } else {
    db = new SQL.Database();
    createTables();
    insertDefaultData();
  }
  
  ensureDefaultModules();
}

function migrateDb() {
  try { db.run('ALTER TABLE module_configs ADD COLUMN extra_data TEXT DEFAULT \'{}\''); } catch (e) {}
  try { db.run(`
    CREATE TABLE IF NOT EXISTS friends (
      uid TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'friend',
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `); } catch (e) {}
  try { db.run(`
    CREATE TABLE IF NOT EXISTS task_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      discovered_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `); } catch (e) {}
  try { db.run(`
    CREATE TABLE IF NOT EXISTS task_configs (
      task_id TEXT PRIMARY KEY,
      action_type TEXT NOT NULL DEFAULT 'replace',
      action_module TEXT DEFAULT '',
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `); } catch (e) {}
  try { db.run(`
    CREATE TABLE IF NOT EXISTS faction_task_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      discovered_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `); } catch (e) {}
  try { db.run(`
    CREATE TABLE IF NOT EXISTS faction_task_configs (
      task_id TEXT PRIMARY KEY,
      action_type TEXT NOT NULL DEFAULT 'skip',
      action_module TEXT DEFAULT '',
      action_params TEXT DEFAULT '{}',
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `); } catch (e) {}
  try { db.run(`
    CREATE TABLE IF NOT EXISTS knight_mission_types (
      name TEXT PRIMARY KEY,
      reward TEXT DEFAULT '',
      duration INTEGER DEFAULT 0,
      discovered_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `); } catch (e) {}
  try { db.run(`
    CREATE TABLE IF NOT EXISTS knight_mission_configs (
      mission_name TEXT PRIMARY KEY,
      enabled INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `); } catch (e) {}
  saveDb();
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS module_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      cmd TEXT NOT NULL,
      params TEXT DEFAULT '{}',
      auto_enabled INTEGER DEFAULT 0,
      auto_time TEXT DEFAULT '',
      manual_enabled INTEGER DEFAULT 1,
      description TEXT DEFAULT '',
      extra_data TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS exec_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id TEXT,
      module_name TEXT,
      command TEXT,
      result TEXT,
      status TEXT DEFAULT 'success',
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS cookies (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS friends (
      uid TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'friend',
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS task_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      discovered_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS task_configs (
      task_id TEXT PRIMARY KEY,
      action_type TEXT NOT NULL DEFAULT 'replace',
      action_module TEXT DEFAULT '',
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `);
}

function insertDefaultData() {
  saveDb();
}

function ensureDefaultModules() {
  // 不再使用数据库存储模块配置
}

function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function toObjects(result) {
  if (!result || result.length === 0) return [];
  
  const columns = result[0].columns;
  const values = result[0].values;
  
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

const moduleConfigs = {
  getAll: () => {
    const result = db.exec('SELECT * FROM module_configs');
    return toObjects(result);
  },
  
  getById: (id) => {
    const stmt = db.prepare('SELECT * FROM module_configs WHERE id = ?');
    stmt.bind([id]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
  },
  
  update: (id, data) => {
    const fields = [];
    const values = [];
    Object.keys(data).forEach(key => {
      fields.push(`${key} = ?`);
      values.push(data[key]);
    });
    if (fields.length === 0) return;
    values.push(id);
    db.run(`UPDATE module_configs SET ${fields.join(', ')}, updated_at = datetime('now', 'localtime') WHERE id = ?`, values);
    saveDb();
  },
  
  upsert: (id, name, category, description) => {
    db.run(`
      INSERT INTO module_configs (id, name, category, description, cmd)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, category = excluded.category, description = excluded.description
    `, [id, name, category, description, id]);
    saveDb();
  },
  
  getEnabledAutoModules: () => {
    const result = db.exec('SELECT * FROM module_configs WHERE auto_enabled = 1');
    return toObjects(result);
  },
  
  reset: () => {
    db.run('DELETE FROM module_configs');
    saveDb();
  },
};

const execLogs = {
  add: (moduleId, moduleName, command, result, status = 'success') => {
    db.run(`
      INSERT INTO exec_logs (module_id, module_name, command, result, status)
      VALUES (?, ?, ?, ?, ?)
    `, [moduleId, moduleName, command, result, status]);
    saveDb();
  },
  
  getByDate: (date) => {
    const result = db.exec(
      `SELECT * FROM exec_logs WHERE date(created_at) = date('${date}') ORDER BY created_at DESC`
    );
    return toObjects(result);
  },
  
  getAll: (limit = 50) => {
    const result = db.exec(`SELECT * FROM exec_logs ORDER BY created_at DESC LIMIT ${limit}`);
    return toObjects(result);
  },
  
  clear: () => {
    db.run('DELETE FROM exec_logs');
    saveDb();
  },
};

const cookieDb = {
  get: () => {
    const stmt = db.prepare('SELECT value FROM cookies WHERE id = 1');
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
  },
  
  set: (value) => {
    db.run(`
      INSERT INTO cookies (id, value, updated_at)
      VALUES (1, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `, [value]);
    saveDb();
  },
  
  exists: () => {
    const stmt = db.prepare('SELECT 1 FROM cookies WHERE id = 1');
    const exists = stmt.step();
    stmt.free();
    return exists;
  },
  
  clear: () => {
    db.run('DELETE FROM cookies WHERE id = 1');
    saveDb();
  },
};

const friends = {
  getAll: () => {
    const result = db.exec('SELECT * FROM friends ORDER BY type, name');
    return toObjects(result);
  },
  
  getEnabled: () => {
    const result = db.exec('SELECT * FROM friends WHERE enabled = 1 ORDER BY type, name');
    return toObjects(result);
  },
  
  getByUid: (uid) => {
    const stmt = db.prepare('SELECT * FROM friends WHERE uid = ?');
    stmt.bind([uid]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
  },
  
  upsert: (uid, name, type = 'friend', enabled = true) => {
    db.run(`
      INSERT INTO friends (uid, name, type, enabled)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(uid) DO UPDATE SET 
        name = excluded.name, 
        type = excluded.type,
        enabled = excluded.enabled,
        updated_at = datetime('now', 'localtime')
    `, [uid, name, type, enabled ? 1 : 0]);
    saveDb();
  },
  
  upsertBatch: (friendsList) => {
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
    saveDb();
  },
  
  setEnabled: (uid, enabled) => {
    db.run('UPDATE friends SET enabled = ?, updated_at = datetime(\'now\', \'localtime\') WHERE uid = ?', [enabled ? 1 : 0, uid]);
    saveDb();
  },
  
  setEnabledBatch: (uids, enabled) => {
    for (const uid of uids) {
      db.run('UPDATE friends SET enabled = ?, updated_at = datetime(\'now\', \'localtime\') WHERE uid = ?', [enabled ? 1 : 0, uid]);
    }
    saveDb();
  },
  
  delete: (uid) => {
    db.run('DELETE FROM friends WHERE uid = ?', [uid]);
    saveDb();
  },
  
  clear: () => {
    db.run('DELETE FROM friends');
    saveDb();
  },
};

const settings = {
  get: (key, defaultValue = null) => {
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    stmt.bind([key]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    if (row && row.value !== null) {
      try {
        return JSON.parse(row.value);
      } catch {
        return row.value;
      }
    }
    return defaultValue;
  },
  
  set: (key, value) => {
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    db.run(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [key, valueStr]);
    saveDb();
  },
  
  delete: (key) => {
    db.run('DELETE FROM settings WHERE key = ?', [key]);
    saveDb();
  },
};

const taskTypes = {
  getAll: () => {
    const result = db.exec('SELECT * FROM task_types ORDER BY name');
    return toObjects(result);
  },
  
  getById: (id) => {
    const stmt = db.prepare('SELECT * FROM task_types WHERE id = ?');
    stmt.bind([id]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
  },
  
  upsert: (id, name, description = '') => {
    db.run(`
      INSERT INTO task_types (id, name, description)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description
    `, [id, name, description]);
    saveDb();
  },
  
  upsertBatch: (tasks) => {
    for (const task of tasks) {
      db.run(`
        INSERT INTO task_types (id, name)
        VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name
      `, [task.id, task.name]);
    }
    saveDb();
  },
  
  delete: (id) => {
    db.run('DELETE FROM task_types WHERE id = ?', [id]);
    saveDb();
  },
  
  clear: () => {
    db.run('DELETE FROM task_types');
    saveDb();
  },
};

const taskConfigs = {
  getAll: () => {
    const result = db.exec(`
      SELECT tc.*, tt.name as task_name 
      FROM task_configs tc 
      LEFT JOIN task_types tt ON tc.task_id = tt.id 
      ORDER BY tt.name
    `);
    return toObjects(result);
  },
  
  getByTaskId: (taskId) => {
    const stmt = db.prepare('SELECT * FROM task_configs WHERE task_id = ?');
    stmt.bind([taskId]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
  },
  
  upsert: (taskId, actionType, actionModule = '') => {
    db.run(`
      INSERT INTO task_configs (task_id, action_type, action_module)
      VALUES (?, ?, ?)
      ON CONFLICT(task_id) DO UPDATE SET 
        action_type = excluded.action_type, 
        action_module = excluded.action_module,
        updated_at = datetime('now', 'localtime')
    `, [String(taskId), actionType, actionModule || '']);
    saveDb();
  },
  
  upsertBatch: (configs) => {
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
    saveDb();
  },
  
  delete: (taskId) => {
    db.run('DELETE FROM task_configs WHERE task_id = ?', [taskId]);
    saveDb();
  },
  
  clear: () => {
    db.run('DELETE FROM task_configs');
    saveDb();
  },
};

const factionTaskTypes = {
  getAll: () => {
    const result = db.exec('SELECT * FROM faction_task_types ORDER BY id');
    return toObjects(result);
  },
  
  getById: (id) => {
    const stmt = db.prepare('SELECT * FROM faction_task_types WHERE id = ?');
    stmt.bind([id]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
  },
  
  upsert: (id, name, description = '') => {
    db.run(`
      INSERT INTO faction_task_types (id, name, description)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description
    `, [id, name, description]);
    saveDb();
  },
  
  upsertBatch: (tasks) => {
    for (const task of tasks) {
      db.run(`
        INSERT INTO faction_task_types (id, name)
        VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name
      `, [task.id, task.name]);
    }
    saveDb();
  },
  
  delete: (id) => {
    db.run('DELETE FROM faction_task_types WHERE id = ?', [id]);
    saveDb();
  },
  
  clear: () => {
    db.run('DELETE FROM faction_task_types');
    saveDb();
  },
};

const factionTaskConfigs = {
  getAll: () => {
    const result = db.exec(`
      SELECT fc.*, ft.name as task_name 
      FROM faction_task_configs fc 
      LEFT JOIN faction_task_types ft ON fc.task_id = ft.id 
      ORDER BY ft.name
    `);
    return toObjects(result);
  },
  
  getByTaskId: (taskId) => {
    const stmt = db.prepare('SELECT * FROM faction_task_configs WHERE task_id = ?');
    stmt.bind([taskId]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
  },
  
  upsert: (taskId, actionType, actionModule = '', actionParams = '{}') => {
    db.run(`
      INSERT INTO faction_task_configs (task_id, action_type, action_module, action_params)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(task_id) DO UPDATE SET 
        action_type = excluded.action_type, 
        action_module = excluded.action_module,
        action_params = excluded.action_params,
        updated_at = datetime('now', 'localtime')
    `, [taskId, actionType, actionModule, actionParams]);
    saveDb();
  },
  
  delete: (taskId) => {
    db.run('DELETE FROM faction_task_configs WHERE task_id = ?', [taskId]);
    saveDb();
  },
  
  clear: () => {
    db.run('DELETE FROM faction_task_configs');
    saveDb();
  },
};

const knightMissionTypes = {
  getAll: () => {
    const result = db.exec('SELECT * FROM knight_mission_types ORDER BY name');
    return toObjects(result);
  },
  
  getByName: (name) => {
    const stmt = db.prepare('SELECT * FROM knight_mission_types WHERE name = ?');
    stmt.bind([name]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
  },
  
  upsert: (name, reward = '', duration = 0) => {
    db.run(`
      INSERT INTO knight_mission_types (name, reward, duration)
      VALUES (?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET reward = excluded.reward, duration = excluded.duration
    `, [name, reward, duration]);
    saveDb();
  },
  
  upsertBatch: (missions) => {
    for (const m of missions) {
      db.run(`
        INSERT INTO knight_mission_types (name, reward, duration)
        VALUES (?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET reward = excluded.reward, duration = excluded.duration
      `, [m.name, m.reward || '', m.duration || 0]);
    }
    saveDb();
  },
  
  delete: (name) => {
    db.run('DELETE FROM knight_mission_types WHERE name = ?', [name]);
    saveDb();
  },
  
  clear: () => {
    db.run('DELETE FROM knight_mission_types');
    saveDb();
  },
};

const knightMissionConfigs = {
  getAll: () => {
    const result = db.exec(`
      SELECT mc.*, mt.reward, mt.duration
      FROM knight_mission_configs mc
      LEFT JOIN knight_mission_types mt ON mc.mission_name = mt.name
      ORDER BY mc.mission_name
    `);
    return toObjects(result);
  },
  
  getByName: (name) => {
    const stmt = db.prepare('SELECT * FROM knight_mission_configs WHERE mission_name = ?');
    stmt.bind([name]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
  },
  
  isEnabled: (name) => {
    const config = knightMissionConfigs.getByName(name);
    return config ? config.enabled === 1 : true;
  },
  
  upsert: (name, enabled = true) => {
    db.run(`
      INSERT INTO knight_mission_configs (mission_name, enabled)
      VALUES (?, ?)
      ON CONFLICT(mission_name) DO UPDATE SET enabled = excluded.enabled, updated_at = datetime('now', 'localtime')
    `, [name, enabled ? 1 : 0]);
    saveDb();
  },
  
  upsertBatch: (configs) => {
    for (const c of configs) {
      db.run(`
        INSERT INTO knight_mission_configs (mission_name, enabled)
        VALUES (?, ?)
        ON CONFLICT(mission_name) DO UPDATE SET enabled = excluded.enabled, updated_at = datetime('now', 'localtime')
      `, [c.name, c.enabled ? 1 : 0]);
    }
    saveDb();
  },
  
  delete: (name) => {
    db.run('DELETE FROM knight_mission_configs WHERE mission_name = ?', [name]);
    saveDb();
  },
  
  clear: () => {
    db.run('DELETE FROM knight_mission_configs');
    saveDb();
  },
};

module.exports = {
  initDb,
  saveDb,
  execLogs,
  cookieDb,
  moduleConfigs,
  friends,
  taskTypes,
  taskConfigs,
  factionTaskTypes,
  factionTaskConfigs,
  knightMissionTypes,
  knightMissionConfigs,
  settings,
};