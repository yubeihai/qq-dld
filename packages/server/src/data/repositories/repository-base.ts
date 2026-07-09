import Database from 'better-sqlite3';
import { DataLayer } from '../data-layer';

export abstract class RepositoryBase<T> {
  protected db: Database.Database;
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
    this.db = DataLayer.getInstance().getDb();
  }

  findById(id: number): T | undefined {
    return this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(id) as T | undefined;
  }

  findAll(): T[] {
    return this.db.prepare(`SELECT * FROM ${this.tableName} ORDER BY id`).all() as T[];
  }

  deleteById(id: number): boolean {
    const result = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`).run(id);
    return result.changes > 0;
  }
}
