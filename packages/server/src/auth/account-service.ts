import type { Account } from '@qq-dld/shared';
import { AccountRepo } from '../data/repositories/account-repo';
import { SettingsRepo } from '../data/repositories/settings-repo';
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

export type PublicAccount = Omit<Account, 'cookies'>;

const ACTIVE_ACCOUNT_KEY = 'current_account_id';

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
  private settingsRepo: SettingsRepo;

  constructor() {
    DataLayer.getInstance();
    this.accountRepo = new AccountRepo();
    this.settingsRepo = new SettingsRepo();
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

  updateProfile(id: number, data: { nickname?: string; cookies?: string }): boolean {
    return this.accountRepo.update(id, data);
  }

  delete(id: number): boolean {
    return this.accountRepo.deleteById(id);
  }

  list(): PublicAccount[] {
    return this.findAll().map((a) => this.toPublic(a));
  }

  toPublic(account: Account): PublicAccount {
    return {
      id: account.id,
      uin: account.uin,
      nickname: account.nickname,
      status: account.status,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  switch(id: number): boolean {
    if (!this.findById(id)) return false;
    this.settingsRepo.set(ACTIVE_ACCOUNT_KEY, String(id));
    return true;
  }

  getActiveAccountId(): number | null {
    const value = this.settingsRepo.get(ACTIVE_ACCOUNT_KEY);
    return value ? parseInt(value, 10) : null;
  }

  getCookies(id: number): string | undefined {
    return this.findById(id)?.cookies;
  }
}
