import { ModuleRegistry } from './registry';
import { DataLayer } from '../data/data-layer';

export class ModuleExecutor {
  async runModule(moduleId: string, params?: Record<string, unknown>) {
    const mod = ModuleRegistry.get(moduleId);
    if (!mod) {
      throw new Error(`Module ${moduleId} not found`);
    }
    const result = await mod.run(params);
    const db = DataLayer.getInstance().getDb();
    db.prepare(`
      INSERT INTO exec_logs (account_id, module_id, status, message, started_at, finished_at, duration)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(1, moduleId, result.status, result.error || '', result.startedAt, result.finishedAt || null, result.duration || null);
    return result;
  }

  async runAll(params?: Record<string, unknown>) {
    const modules = ModuleRegistry.getAll();
    const results = [];
    for (const mod of modules) {
      const result = await this.runModule(mod.id, params);
      results.push(result);
    }
    return results;
  }
}
