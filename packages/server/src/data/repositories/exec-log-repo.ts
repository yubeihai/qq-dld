import { RepositoryBase } from './repository-base';
import type { ExecLog } from '@qq-dld/shared';

interface ExecLogRow {
  id: number;
  account_id: number;
  module_id: string;
  status: string;
  message: string;
  started_at: string;
  finished_at: string | null;
  duration: number | null;
}

function toExecLog(row: ExecLogRow): ExecLog {
  return {
    id: row.id,
    accountId: row.account_id,
    moduleId: row.module_id,
    status: row.status as ExecLog['status'],
    message: row.message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    duration: row.duration,
  };
}

interface CreateExecLog {
  accountId: number;
  moduleId: string;
  message?: string;
}

export class ExecLogRepo extends RepositoryBase<ExecLogRow> {
  constructor() {
    super('exec_logs');
  }

  findByAccount(accountId: number, limit = 50): ExecLog[] {
    const rows = this.db.prepare('SELECT * FROM exec_logs WHERE account_id = ? ORDER BY id DESC LIMIT ?').all(accountId, limit) as ExecLogRow[];
    return rows.map(toExecLog);
  }

  create(data: CreateExecLog): ExecLog {
    const result = this.db.prepare('INSERT INTO exec_logs (account_id, module_id, message) VALUES (?, ?, ?)').run(data.accountId, data.moduleId, data.message || '');
    return toExecLog(this.findById(result.lastInsertRowid as number) as ExecLogRow);
  }

  complete(id: number, status: 'success' | 'fail', message: string): boolean {
    const result = this.db.prepare(`
      UPDATE exec_logs SET status = ?, message = ?, finished_at = datetime('now'),
        duration = CAST((julianday('now') - julianday(started_at)) * 86400 AS INTEGER)
      WHERE id = ?
    `).run(status, message, id);
    return result.changes > 0;
  }

  deleteOlderThan(accountId: number, keepCount: number): number {
    const result = this.db.prepare(`
      DELETE FROM exec_logs WHERE id IN (
        SELECT id FROM exec_logs WHERE account_id = ? ORDER BY id DESC
        LIMIT -1 OFFSET ?
      )
    `).run(accountId, keepCount);
    return result.changes;
  }
}
