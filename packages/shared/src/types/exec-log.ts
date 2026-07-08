export interface ExecLog {
  id: number;
  moduleId: string;
  accountId: number;
  status: 'success' | 'fail' | 'partial';
  result?: string;
  error?: string;
  createdAt: string;
}
