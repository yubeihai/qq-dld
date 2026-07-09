export interface Module {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  order: number;
}

export interface ModuleConfig {
  moduleId: string;
  accountId: number;
  config: Record<string, unknown>;
  enabled: boolean;
}
