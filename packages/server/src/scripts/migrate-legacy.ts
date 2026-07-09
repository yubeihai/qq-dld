import Database from 'better-sqlite3';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DataLayer } from '../data/data-layer';

const LEGACY_PATH = path.resolve(process.cwd(), 'data', 'database.sqlite');
const MIGRATION_MARKER_KEY = '_legacy_migration_checksum';

function checksum(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

interface LegacyRow {
  [key: string]: unknown;
}

function isDone(dataLayer: DataLayer): boolean {
  const db = dataLayer.getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ? AND account_id IS NULL').get(MIGRATION_MARKER_KEY) as { value: string } | undefined;
  return !!row;
}

function markDone(dataLayer: DataLayer): void {
  const content = JSON.stringify({ migratedAt: new Date().toISOString(), tables: legacyTableNames });
  const db = dataLayer.getDb();
  db.prepare("INSERT INTO settings (account_id, key, value) VALUES (NULL, ?, ?)").run(MIGRATION_MARKER_KEY, checksum(content));
}

const legacyTableNames = ['cookies', 'module_configs', 'exec_logs', 'friends', 'task_configs', 'settings'];

function migrateCookies(oldDb: Database.Database, newDb: Database.Database): void {
  const rows = oldDb.prepare('SELECT * FROM cookies').all() as LegacyRow[];
  const stmt = newDb.prepare('INSERT OR IGNORE INTO accounts (uin, nickname, cookies, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
  for (const row of rows) {
    stmt.run(row.uin, row.nickname || '', row.cookies || '', row.status || 'active', row.created_at || new Date().toISOString(), row.updated_at || new Date().toISOString());
  }
}

function migrateModuleConfigs(oldDb: Database.Database, newDb: Database.Database): void {
  const rows = oldDb.prepare('SELECT * FROM module_configs').all() as LegacyRow[];
  const stmt = newDb.prepare('INSERT OR REPLACE INTO module_configs (account_id, module_id, config, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
  for (const row of rows) {
    stmt.run(row.account_id, row.module_id, typeof row.config === 'string' ? row.config : '{}', row.enabled ?? 1, new Date().toISOString(), new Date().toISOString());
  }
}

function migrateExecLogs(oldDb: Database.Database, newDb: Database.Database): void {
  const rows = oldDb.prepare('SELECT * FROM exec_logs').all() as LegacyRow[];
  const stmt = newDb.prepare('INSERT INTO exec_logs (account_id, module_id, status, message, started_at, finished_at, duration) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const row of rows) {
    stmt.run(row.account_id, row.module_id, row.status || 'success', row.message || '', row.started_at || new Date().toISOString(), row.finished_at || null, row.duration || null);
  }
}

function migrateFriends(oldDb: Database.Database, newDb: Database.Database): void {
  const rows = oldDb.prepare('SELECT * FROM friends').all() as LegacyRow[];
  const stmt = newDb.prepare('INSERT OR IGNORE INTO friends (account_id, uin, nickname, level, last_fight_at) VALUES (?, ?, ?, ?, ?)');
  for (const row of rows) {
    stmt.run(row.account_id, row.uin, row.nickname || '', row.level || 0, row.last_fight_at || null);
  }
}

function migrateTaskConfigs(oldDb: Database.Database, newDb: Database.Database): void {
  const rows = oldDb.prepare('SELECT * FROM task_configs').all() as LegacyRow[];
  const stmt = newDb.prepare('INSERT OR REPLACE INTO task_configs (account_id, module_id, schedule, enabled, params, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const row of rows) {
    stmt.run(row.account_id, row.module_id, row.schedule || '', row.enabled ?? 1, typeof row.params === 'string' ? row.params : '{}', new Date().toISOString(), new Date().toISOString());
  }
}

function migrateSettings(oldDb: Database.Database, newDb: Database.Database): void {
  const rows = oldDb.prepare('SELECT * FROM settings').all() as LegacyRow[];
  const stmt = newDb.prepare('INSERT OR REPLACE INTO settings (account_id, key, value) VALUES (?, ?, ?)');
  for (const row of rows) {
    stmt.run(row.account_id || null, row.key, row.value || '');
  }
}

function main(): void {
  const dataLayer = DataLayer.initialize();

  if (isDone(dataLayer)) {
    console.log('Legacy migration already completed. Skipping.');
    dataLayer.close();
    return;
  }

  const oldDb = new Database(LEGACY_PATH, { readonly: true });
  const newDb = dataLayer.getDb();

  const migrateFns: Record<string, (old: Database.Database, n: Database.Database) => void> = {
    cookies: migrateCookies,
    module_configs: migrateModuleConfigs,
    exec_logs: migrateExecLogs,
    friends: migrateFriends,
    task_configs: migrateTaskConfigs,
    settings: migrateSettings,
  };

  const existingTables = oldDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
  const existingNames = new Set(existingTables.map((t) => t.name));

  for (const tableName of legacyTableNames) {
    if (!existingNames.has(tableName)) {
      console.log(`  SKIP ${tableName} (table not found in legacy db)`);
      continue;
    }
    const fn = migrateFns[tableName];
    if (fn) {
      console.log(`  Migrating ${tableName}...`);
      fn(oldDb, newDb);
    }
  }

  markDone(dataLayer);
  oldDb.close();
  dataLayer.close();
}

main();
