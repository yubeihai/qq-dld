export interface Account {
  id: number;
  nickname: string;
  uin?: string;
  cookie?: string;
  status: 'active' | 'disabled' | 'expired';
  createdAt: string;
  updatedAt: string;
}
