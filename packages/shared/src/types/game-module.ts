export type ModuleStatus = 'success' | 'fail' | 'running';

export interface ActionResult {
  moduleId: string;
  status: ModuleStatus;
  data?: unknown;
  error?: string;
  startedAt: string;
  finishedAt?: string;
  duration?: number;
}

export interface ModuleMeta {
  id: string;
  name: string;
  description: string;
  category: string;
}
