import { RepositoryBase } from './repository-base';
import type { TaskConfig } from '@qq-dld/shared';

interface TaskConfigRow {
  id: number;
  account_id: number;
  module_id: string;
  schedule: string;
  enabled: number;
  params: string;
  created_at: string;
  updated_at: string;
}

function toTaskConfig(row: TaskConfigRow): TaskConfig {
  return {
    id: row.id,
    accountId: row.account_id,
    moduleId: row.module_id,
    schedule: row.schedule,
    enabled: row.enabled === 1,
    params: JSON.parse(row.params || '{}'),
  };
}

export class TaskConfigRepo extends RepositoryBase<TaskConfigRow> {
  constructor() {
    super('task_configs');
  }

  findByAccount(accountId: number): TaskConfig[] {
    const rows = this.db.prepare('SELECT * FROM task_configs WHERE account_id = ? ORDER BY module_id').all(accountId) as TaskConfigRow[];
    return rows.map(toTaskConfig);
  }

  upsert(data: { accountId: number; moduleId: string; schedule: string; enabled?: boolean; params?: Record<string, unknown> }): TaskConfig {
    const enabled = data.enabled !== false ? 1 : 0;
    const paramsStr = JSON.stringify(data.params || {});
    this.db.prepare(`
      INSERT INTO task_configs (account_id, module_id, schedule, enabled, params)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(account_id, module_id) DO UPDATE SET
        schedule = excluded.schedule,
        enabled = excluded.enabled,
        params = excluded.params,
        updated_at = datetime('now')
    `).run(data.accountId, data.moduleId, data.schedule, enabled, paramsStr);
    const row = this.db.prepare('SELECT * FROM task_configs WHERE account_id = ? AND module_id = ?').get(data.accountId, data.moduleId) as TaskConfigRow;
    return toTaskConfig(row);
  }
}
