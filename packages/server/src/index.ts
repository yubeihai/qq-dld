import type { Account } from '@qq-dld/shared';

const sampleAccount: Account = {
  id: 1,
  nickname: 'sample',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

console.log('[qq-dld/server] skeleton ready', sampleAccount.nickname);
