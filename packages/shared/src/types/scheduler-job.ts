export interface SchedulerJob {
  id: number;
  accountId: number;
  moduleId: string;
  schedule: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  enabled: boolean;
}
