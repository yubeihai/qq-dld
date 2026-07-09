import type { ActionResult } from '@qq-dld/shared';

export abstract class ModuleBase {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;

  constructor(meta: { id: string; name: string; description: string; category: string }) {
    this.id = meta.id;
    this.name = meta.name;
    this.description = meta.description;
    this.category = meta.category;
  }

  abstract execute(params?: Record<string, unknown>): Promise<Record<string, unknown>>;

  async run(params?: Record<string, unknown>): Promise<ActionResult> {
    const startedAt = new Date().toISOString();
    try {
      const data = await this.execute(params);
      const finishedAt = new Date().toISOString();
      return {
        moduleId: this.id,
        status: 'success',
        data,
        startedAt,
        finishedAt,
        duration: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
      };
    } catch (error) {
      const finishedAt = new Date().toISOString();
      return {
        moduleId: this.id,
        status: 'fail',
        error: error instanceof Error ? error.message : String(error),
        startedAt,
        finishedAt,
        duration: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
      };
    }
  }
}
