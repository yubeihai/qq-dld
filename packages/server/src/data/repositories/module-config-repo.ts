import { RepositoryBase } from './repository-base';

interface ModuleConfigRow {
  id: number;
  account_id: number;
  module_id: string;
  config: string;
  enabled: number;
}

interface CreateModuleConfig {
  accountId: number;
  moduleId: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
}

export class ModuleConfigRepo extends RepositoryBase<ModuleConfigRow> {
  constructor() {
    super('module_configs');
  }

  findByAccount(accountId: number): ModuleConfigRow[] {
    return this.db.prepare('SELECT * FROM module_configs WHERE account_id = ? ORDER BY module_id').all(accountId) as ModuleConfigRow[];
  }

  findByModule(accountId: number, moduleId: string): ModuleConfigRow | undefined {
    return this.db.prepare('SELECT * FROM module_configs WHERE account_id = ? AND module_id = ?').get(accountId, moduleId) as ModuleConfigRow | undefined;
  }

  upsert(data: CreateModuleConfig): ModuleConfigRow {
    const configStr = JSON.stringify(data.config || {});
    const enabled = data.enabled !== false ? 1 : 0;
    this.db.prepare(`
      INSERT INTO module_configs (account_id, module_id, config, enabled)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(account_id, module_id) DO UPDATE SET
        config = excluded.config,
        enabled = excluded.enabled,
        updated_at = datetime('now')
    `).run(data.accountId, data.moduleId, configStr, enabled);
    return this.findByModule(data.accountId, data.moduleId)!;
  }
}
