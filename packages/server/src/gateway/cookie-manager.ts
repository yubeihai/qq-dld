import { AccountRepo } from '../data/repositories/account-repo';
import { DataLayer } from '../data/data-layer';

export class CookieManager {
  private accountRepo: AccountRepo;

  constructor() {
    DataLayer.getInstance();
    this.accountRepo = new AccountRepo();
  }

  getCookie(accountId: number): string | undefined {
    const row = this.accountRepo.findById(accountId);
    return row?.cookies;
  }

  setCookie(accountId: number, cookies: string): void {
    this.accountRepo.update(accountId, { cookies });
  }

  hasCookie(accountId: number): boolean {
    const cookie = this.getCookie(accountId);
    return !!cookie;
  }
}
