import type { Account } from '@qq-dld/shared';

const greeting = (account: Account): string => `Hello, ${account.nickname}!`;

export { greeting };
export type { Account };
