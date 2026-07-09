import { RepositoryBase } from './repository-base';
import type { Account } from '@qq-dld/shared';

interface AccountRow {
  id: number;
  uin: string;
  nickname: string;
  cookies: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    uin: row.uin,
    nickname: row.nickname,
    cookies: row.cookies,
    status: row.status as Account['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface CreateAccount {
  uin: string;
  nickname?: string;
  cookies?: string;
}

export class AccountRepo extends RepositoryBase<AccountRow> {
  constructor() {
    super('accounts');
  }

  findByUin(uin: string): Account | undefined {
    const row = this.db.prepare('SELECT * FROM accounts WHERE uin = ?').get(uin) as AccountRow | undefined;
    return row ? toAccount(row) : undefined;
  }

  create(data: CreateAccount): Account {
    const stmt = this.db.prepare('INSERT INTO accounts (uin, nickname, cookies) VALUES (?, ?, ?)');
    const result = stmt.run(data.uin, data.nickname || '', data.cookies || '');
    return toAccount(this.findById(result.lastInsertRowid as number) as AccountRow);
  }

  update(id: number, data: Partial<CreateAccount & { status: string }>): boolean {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (data.uin !== undefined) { sets.push('uin = ?'); params.push(data.uin); }
    if (data.nickname !== undefined) { sets.push('nickname = ?'); params.push(data.nickname); }
    if (data.cookies !== undefined) { sets.push('cookies = ?'); params.push(data.cookies); }
    if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
    if (sets.length === 0) return false;
    sets.push('updated_at = datetime(\'now\')');
    params.push(id);
    const result = this.db.prepare(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return result.changes > 0;
  }
}
