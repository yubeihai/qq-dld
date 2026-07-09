import Database from 'better-sqlite3';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

function checksum(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function findMigrationsDir(): string {
  const candidates = [
    path.resolve(__dirname, '..', '..', 'migrations'),
    path.resolve(process.cwd(), 'packages', 'server', 'migrations'),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return candidates[0];
}

export class DataLayer {
  private static instance: DataLayer | null = null;
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolved = dbPath || process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'database.sqlite');
    this.db = new Database(resolved);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  static initialize(dbPath?: string): DataLayer {
    if (DataLayer.instance) {
      throw new Error('DataLayer already initialized');
    }
    DataLayer.instance = new DataLayer(dbPath);
    DataLayer.instance.applyMigrations();
    return DataLayer.instance;
  }

  static getInstance(): DataLayer {
    if (!DataLayer.instance) {
      throw new Error('DataLayer not initialized. Call DataLayer.initialize() first.');
    }
    return DataLayer.instance;
  }

  getDb(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
    DataLayer.instance = null;
  }

  private applyMigrations(): void {
    this.db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);

    const migrationsDir = findMigrationsDir();
    if (!existsSync(migrationsDir)) return;

    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const existing = this.db.prepare('SELECT checksum FROM _migrations WHERE filename = ?').get(file) as { checksum: string } | undefined;
      const content = readFileSync(path.resolve(migrationsDir, file), 'utf-8');
      const chk = checksum(content);

      if (existing) {
        if (existing.checksum !== chk) {
          throw new Error(`Migration ${file} has been modified since applied (checksum mismatch)`);
        }
        continue;
      }

      this.db.exec(content);
      this.db.prepare('INSERT INTO _migrations (filename, checksum) VALUES (?, ?)').run(file, chk);
    }
  }
}
