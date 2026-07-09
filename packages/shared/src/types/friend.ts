export interface Friend {
  id: number;
  accountId: number;
  uin: string;
  nickname: string;
  level: number;
  lastFightAt: string | null;
}
