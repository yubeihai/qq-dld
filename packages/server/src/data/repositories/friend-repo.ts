import { RepositoryBase } from './repository-base';
import type { Friend } from '@qq-dld/shared';

interface FriendRow {
  id: number;
  account_id: number;
  uin: string;
  nickname: string;
  level: number;
  last_fight_at: string | null;
}

function toFriend(row: FriendRow): Friend {
  return {
    id: row.id,
    accountId: row.account_id,
    uin: row.uin,
    nickname: row.nickname,
    level: row.level,
    lastFightAt: row.last_fight_at,
  };
}

interface CreateFriend {
  accountId: number;
  uin: string;
  nickname?: string;
  level?: number;
}

export class FriendRepo extends RepositoryBase<FriendRow> {
  constructor() {
    super('friends');
  }

  findByAccount(accountId: number): Friend[] {
    const rows = this.db.prepare('SELECT * FROM friends WHERE account_id = ? ORDER BY level DESC').all(accountId) as FriendRow[];
    return rows.map(toFriend);
  }

  upsert(data: CreateFriend): Friend {
    this.db.prepare(`
      INSERT INTO friends (account_id, uin, nickname, level)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(account_id, uin) DO UPDATE SET
        nickname = excluded.nickname,
        level = excluded.level
    `).run(data.accountId, data.uin, data.nickname || '', data.level || 0);
    const row = this.db.prepare('SELECT * FROM friends WHERE account_id = ? AND uin = ?').get(data.accountId, data.uin) as FriendRow;
    return toFriend(row);
  }
}
