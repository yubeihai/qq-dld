import { ModuleBase } from '../../modules/module-base';

export class AdventureModule extends ModuleBase {
  constructor() {
    super({ id: 'adventure', name: '冒险探索', description: '冒险探索', category: '每日任务' });
  }

  async execute(): Promise<Record<string, unknown>> {
    return { message: 'adventure not yet implemented' };
  }
}
