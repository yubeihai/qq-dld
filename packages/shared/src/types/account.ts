export interface Account {
  id: number;
  uin: string;
  nickname: string;
  cookies: string;
  status: 'active' | 'inactive' | 'expired';
  createdAt: string;
  updatedAt: string;
}
