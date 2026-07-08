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
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA synchronous=NORMAL');

  createTables();
  migrateDb();
  saveDb();

  return db;
}

function getDb() {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 initDb()');
  }
  return db;
}

let saveTimer = null;

function saveDb() {
  if (!db) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    saveTimer = null;
  }, 500);
}

function saveDbNow() {
  if (!db) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
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

function toObject(result) {
  const rows = toObjects(result);
  return rows.length > 0 ? rows[0] : null;
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
    CREATE TABLE IF NOT EXISTS log_sessions (
      id TEXT PRIMARY KEY,
      module_id TEXT NOT NULL,
      module_name TEXT NOT NULL,
      source TEXT DEFAULT 'manual',
      status TEXT DEFAULT 'running',
      params TEXT DEFAULT '{}',
      summary TEXT DEFAULT '{}',
      request_count INTEGER DEFAULT 0,
      started_at DATETIME DEFAULT (datetime('now', 'localtime')),
      ended_at DATETIME,
      duration_ms INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS log_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      seq INTEGER,
      action TEXT NOT NULL,
      target TEXT DEFAULT '',
      status TEXT DEFAULT 'success',
      detail TEXT DEFAULT '{}',
      error TEXT DEFAULT '',
      duration_ms INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS log_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      cmd TEXT NOT NULL,
      url TEXT DEFAULT '',
      status_code INTEGER DEFAULT 0,
      request_size INTEGER DEFAULT 0,
      response_size INTEGER DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      retry_count INTEGER DEFAULT 0,
      error TEXT DEFAULT '',
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

  db.run(`
    CREATE TABLE IF NOT EXISTS faction_task_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      discovered_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS faction_task_configs (
      task_id TEXT PRIMARY KEY,
      action_type TEXT NOT NULL DEFAULT 'skip',
      action_module TEXT DEFAULT '',
      action_params TEXT DEFAULT '{}',
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS knight_mission_types (
      name TEXT PRIMARY KEY,
      reward TEXT DEFAULT '',
      duration INTEGER DEFAULT 0,
      discovered_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS knight_mission_configs (
      mission_name TEXT PRIMARY KEY,
      enabled INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS badge_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rank TEXT DEFAULT '',
      stage INTEGER DEFAULT 0,
      discovered_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS badge_configs (
      badge_id TEXT PRIMARY KEY,
      enabled INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS exchange_types (
      id TEXT PRIMARY KEY,
      give_item TEXT NOT NULL,
      give_count INTEGER DEFAULT 0,
      get_item TEXT NOT NULL,
      get_count INTEGER DEFAULT 0,
      discovered_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS exchange_configs (
      exchange_id TEXT PRIMARY KEY,
      action TEXT DEFAULT 'reject',
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `);
}

function migrateDb() {
  try { db.run('ALTER TABLE module_configs ADD COLUMN extra_data TEXT DEFAULT \'{}\''); } catch (e) {}
  try { db.run('ALTER TABLE log_sessions ADD COLUMN summary TEXT DEFAULT \'{}\''); } catch (e) {}
  try { db.run('ALTER TABLE log_sessions ADD COLUMN duration_ms INTEGER DEFAULT 0'); } catch (e) {}
  try { db.run('ALTER TABLE log_requests ADD COLUMN url TEXT DEFAULT \'\''); } catch (e) {}
}

module.exports = {
  initDb,
  getDb,
  saveDb,
  saveDbNow,
  toObjects,
  toObject,
};
