export interface Module {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
}

export interface ModuleConfig {
  id: number;
  moduleId: string;
  accountId: number;
  config: Record<string, unknown>;
  enabled: boolean;
}
