import { RepositoryBase } from './repository-base';
import type { Settings } from '@qq-dld/shared';

interface SettingsRow {
  id: number;
  account_id: number | null;
  key: string;
  value: string;
}

function toSettings(row: SettingsRow): Settings {
  return {
    id: row.id,
    accountId: row.account_id,
    key: row.key,
    value: row.value,
  };
}

export class SettingsRepo extends RepositoryBase<SettingsRow> {
  constructor() {
    super('settings');
  }

  get(key: string, accountId: number | null = null): string | undefined {
    const row = this.db.prepare('SELECT * FROM settings WHERE key = ? AND account_id IS ?').get(key, accountId) as SettingsRow | undefined;
    return row?.value;
  }

  set(key: string, value: string, accountId: number | null = null): Settings {
    this.db.prepare(`
      INSERT INTO settings (account_id, key, value)
      VALUES (?, ?, ?)
      ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value
    `).run(accountId, key, value);
    const row = this.db.prepare('SELECT * FROM settings WHERE key = ? AND account_id IS ?').get(key, accountId) as SettingsRow;
    return toSettings(row);
  }

  findByAccount(accountId: number | null): Settings[] {
    const rows = this.db.prepare('SELECT * FROM settings WHERE account_id IS ? ORDER BY key').all(accountId) as SettingsRow[];
    return rows.map(toSettings);
  }
}
