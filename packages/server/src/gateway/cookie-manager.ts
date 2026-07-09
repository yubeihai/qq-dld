import { AccountRepo } from '../data/repositories/account-repo';
import { SettingsRepo } from '../data/repositories/settings-repo';
import { DataLayer } from '../data/data-layer';

const ACTIVE_ACCOUNT_KEY = 'current_account_id';

export class CookieManager {
  private accountRepo: AccountRepo;
  private settingsRepo: SettingsRepo;

  constructor() {
    DataLayer.getInstance();
    this.accountRepo = new AccountRepo();
    this.settingsRepo = new SettingsRepo();
  }

  getCookie(accountId: number): string | undefined {
    return this.accountRepo.findById(accountId)?.cookies;
  }

  setCookie(accountId: number, cookies: string): void {
    this.accountRepo.update(accountId, { cookies });
  }

  hasCookie(accountId: number): boolean {
    return !!this.getCookie(accountId);
  }

  switchAccount(accountId: number): boolean {
    if (!this.accountRepo.findById(accountId)) return false;
    this.settingsRepo.set(ACTIVE_ACCOUNT_KEY, String(accountId));
    return true;
  }

  getActiveAccountId(): number | null {
    const value = this.settingsRepo.get(ACTIVE_ACCOUNT_KEY);
    return value ? parseInt(value, 10) : null;
  }

  getActiveCookies(): string | undefined {
    const id = this.getActiveAccountId();
    return id !== null ? this.getCookie(id) : undefined;
  }

  getCookieHeader(accountId?: number): string {
    const id = accountId ?? this.getActiveAccountId();
    if (id === null) return '';
    return this.getCookie(id) ?? '';
  }
}
