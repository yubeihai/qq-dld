import { ModuleBase } from './module-base';

export class ModuleRegistry {
  private static modules = new Map<string, ModuleBase>();

  static register(module: ModuleBase): void {
    this.modules.set(module.id, module);
  }

  static get(id: string): ModuleBase | undefined {
    return this.modules.get(id);
  }

  static getAll(): ModuleBase[] {
    return Array.from(this.modules.values());
  }

  static getIds(): string[] {
    return Array.from(this.modules.keys());
  }
}
