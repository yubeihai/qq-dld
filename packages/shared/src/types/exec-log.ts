export interface ExecLog {
  id: number;
  accountId: number;
  moduleId: string;
  status: 'success' | 'fail' | 'running';
  message: string;
  startedAt: string;
  finishedAt: string | null;
  duration: number | null;
}
