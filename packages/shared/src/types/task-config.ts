export interface TaskConfig {
  id: number;
  taskTypeId: string;
  accountId: number;
  cron: string;
  enabled: boolean;
  params: Record<string, unknown>;
}
