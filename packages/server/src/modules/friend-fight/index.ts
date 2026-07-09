import { ModuleBase } from '../../modules/module-base';

export class FriendFightModule extends ModuleBase {
  constructor() {
    super({ id: 'friend-fight', name: '乐斗好友', description: '乐斗好友列表', category: '每日任务' });
  }

  async execute(): Promise<Record<string, unknown>> {
    return { message: 'friend-fight not yet implemented' };
  }
}
