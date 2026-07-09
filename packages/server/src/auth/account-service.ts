import type { Account } from '@qq-dld/shared';
import { AccountRepo } from '../data/repositories/account-repo';
import { DataLayer } from '../data/data-layer';

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

export class AccountService {
  private accountRepo: AccountRepo;

  constructor() {
    DataLayer.getInstance();
    this.accountRepo = new AccountRepo();
  }

  findByUin(uin: string): Account | undefined {
    return this.accountRepo.findByUin(uin);
  }

  findById(id: number): Account | undefined {
    const row = this.accountRepo.findById(id) as AccountRow | undefined;
    return row ? toAccount(row) : undefined;
  }

  findAll(): Account[] {
    const rows = this.accountRepo.findAll() as AccountRow[];
    return rows.map(toAccount);
  }

  create(data: { uin: string; nickname?: string; cookies?: string }): Account {
    return this.accountRepo.create(data);
  }

  updateCookies(id: number, cookies: string): boolean {
    return this.accountRepo.update(id, { cookies });
  }

  delete(id: number): boolean {
    return this.accountRepo.deleteById(id);
  }
}
