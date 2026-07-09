export interface TaskConfig {
  id: number;
  moduleId: string;
  accountId: number;
  schedule: string;
  enabled: boolean;
  params: Record<string, unknown>;
}
