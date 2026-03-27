const { ActionBase } = require('../core/action-base');
const { settings, factionTaskTypes, factionTaskConfigs } = require('../db');

const DEFAULT_TASK_CONFIGS = {
  '10': { name: '查看矿洞', actionType: 'visit', cmd: 'factionmine' },
  '12': { name: '查看帮战', actionType: 'visit', cmd: 'facwar', params: { sub: '0', id: '1' } },
  '15': { name: '加速贡献', actionType: 'item', itemId: 'contribution_potion' },
};

class FactionAction extends ActionBase {
  constructor() {
    super({
      id: 'faction',
      name: '帮派',
      description: '帮派供奉守护神、完成帮派任务',
      category: '帮派',
    });
  }

  initDefaultTaskConfigs() {
    for (const [taskId, config] of Object.entries(DEFAULT_TASK_CONFIGS)) {
      const existing = factionTaskConfigs.getByTaskId(taskId);
      if (!existing) {
        factionTaskConfigs.upsert(
          taskId,
          config.actionType,
          config.actionModule || '',
          JSON.stringify({ cmd: config.cmd, params: config.params, itemId: config.itemId })
        );
      }
      const existingType = factionTaskTypes.getById(taskId);
      if (!existingType) {
        factionTaskTypes.upsert(taskId, config.name);
      }
    }
  }

  getOblationConfig() {
    return settings.get('oblation_items', []);
  }

  setOblationConfig(itemIds) {
    settings.set('oblation_items', itemIds);
  }

  getTodayOblationStatus() {
    const today = new Date().toISOString().split('T')[0];
    const lastOblation = settings.get('last_oblation_date', '');
    return lastOblation === today;
  }

  markTodayOblated() {
    const today = new Date().toISOString().split('T')[0];
    settings.set('last_oblation_date', today);
  }

  parseOblationItems(html) {
    if (!html) return [];
    
    const items = [];
    const regex = /([^>\s][^<\n]*?)\s*数量：(\d+)<a[^>]*href="[^"]*cmd=oblation&amp;id=(\d+)[^"]*"[^>]*>供奉<\/a>/g;
    
    let match;
    while ((match = regex.exec(html)) !== null) {
      const name = match[1].trim();
      const quantity = parseInt(match[2]);
      const id = match[3];
      
      if (name && !isNaN(quantity) && id) {
        items.push({ id, name, quantity });
      }
    }
    
    return items;
  }

  parseFactionTasks(html) {
    if (!html) return { tasks: [], rawTasks: [] };

    const tasks = [];
    const rawTasks = [];
    const decodedHtml = html.replace(/&amp;/g, '&');

    const taskRegex = /(\d+)\.\s*<a[^>]*cmd=factiontask[^>]*sub=2[^>]*id=(\d+)[^>]*>([^<]+)<\/a>([^<]*)/gi;
    let match;

    while ((match = taskRegex.exec(decodedHtml)) !== null) {
      const id = match[2];
      const name = match[3].trim();
      const afterLink = match[4];

      const claimRegex = new RegExp(`cmd=factiontask[^"]*sub=3[^"]*id=${id}[^"]*"`, 'i');
      const hasClaimLink = claimRegex.test(decodedHtml);

      let status;
      if (hasClaimLink) {
        status = 'can_claim';
      } else if (afterLink.includes('未完成')) {
        status = 'pending';
      } else {
        status = 'done';
      }

      const taskAlreadyExists = tasks.some(t => t.id === id);
      if (!taskAlreadyExists) {
        tasks.push({ id, name, status });
        rawTasks.push({ id, name });
      }
    }

    return { tasks, rawTasks };
  }

  getTaskConfig(taskId) {
    const config = factionTaskConfigs.getByTaskId(taskId);
    if (config) {
      return {
        actionType: config.action_type,
        actionModule: config.action_module || '',
        actionParams: config.action_params ? JSON.parse(config.action_params) : {},
      };
    }
    return { actionType: 'skip', actionModule: '', actionParams: {} };
  }

  saveTaskTypes(tasks) {
    if (tasks.length > 0) {
      factionTaskTypes.upsertBatch(tasks);
    }
  }

  async doFactionTask(taskId) {
    const html = await this.request('factiontask', { sub: '2', id: String(taskId) });
    return html;
  }

  async claimFactionTask(taskId) {
    const html = await this.request('factiontask', { sub: '3', id: String(taskId) });
    const text = this.extractText(html);

    if (text.includes('获得') || text.includes('奖励')) {
      const match = text.match(/获得[^<\n]*/);
      return { success: true, message: match ? match[0] : '领取成功' };
    }

    return { success: true, message: '已领取' };
  }

  async claimFactionWarReward(logDetails) {
    try {
      const html = await this.request('facwar', { sub: '4' });
      const text = this.extractText(html);

      if (text.includes('获得') || text.includes('奖励') || text.includes('领取')) {
        const match = text.match(/获得[^<\n]*/);
        return { success: true, message: match ? match[0].trim() : '已领取帮战奖励' };
      }

      if (text.includes('未达标') || text.includes('未达到') || text.includes('没有')) {
        return { success: false, message: '帮战奖励未达标' };
      }

      return { success: true, message: '帮战奖励已领取或无需领取' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async runFactionTasks() {
    const logDetails = [];

    try {
      this.initDefaultTaskConfigs();

      const rewardResult = await this.claimFactionWarReward(logDetails);
      if (rewardResult.success) {
        logDetails.push(`[帮战] ${rewardResult.message}`);
      }

      const html = await this.request('factiontask', { sub: '1' });
      const { tasks, rawTasks } = this.parseFactionTasks(html);

      if (rawTasks.length > 0) {
        this.saveTaskTypes(rawTasks);
      }

      if (tasks.length === 0) {
        logDetails.push('没有帮派任务');
        this.log(logDetails.join('\n'), 'info');
        return this.success({ message: '没有帮派任务', tasks: [] });
      }

      logDetails.push(`发现${tasks.length}个帮派任务`);

      let completed = 0;
      let failed = 0;
      let skipped = 0;
      const results = [];

      for (const task of tasks) {
        const config = this.getTaskConfig(task.id);

        if (task.status === 'done') {
          logDetails.push(`[${task.name}] 已完成`);
          results.push({ ...task, result: '已完成' });
          continue;
        }

        if (task.status === 'can_claim') {
          logDetails.push(`[${task.name}] 领取奖励...`);
          const claimResult = await this.claimFactionTask(task.id);
          if (claimResult.success) {
            completed++;
            results.push({ ...task, result: claimResult.message });
            logDetails.push(`  ${claimResult.message}`);
          } else {
            failed++;
            results.push({ ...task, result: claimResult.message });
            logDetails.push(`  领取失败: ${claimResult.message}`);
          }
          await this.delay(500);
          continue;
        }

        if (config.actionType === 'skip') {
          logDetails.push(`[${task.name}] 跳过（未配置操作）`);
          skipped++;
          results.push({ ...task, result: '跳过' });
          continue;
        }

        logDetails.push(`[${task.name}] 执行: ${config.actionType}...`);

        try {
          let execResult = { success: false, message: '未知操作' };

          if (config.actionType === 'visit') {
            execResult = await this.executeVisitTask(config.actionParams);
          } else if (config.actionType === 'item') {
            execResult = await this.executeItemTask(config.actionParams);
          } else if (config.actionType === 'module' && config.actionModule) {
            const action = this.getAction(config.actionModule);
            if (action) {
              const moduleResult = await action.run(config.actionParams);
              execResult = {
                success: moduleResult.success,
                message: moduleResult.result || moduleResult.error || '执行完成',
              };
            } else {
              execResult = { success: false, message: `模块 ${config.actionModule} 不存在` };
            }
          }

          await this.delay(500);

          if (execResult.success) {
            const claimResult = await this.claimFactionTask(task.id);
            if (claimResult.success) {
              completed++;
              results.push({ ...task, result: claimResult.message });
              logDetails.push(`  ${claimResult.message}`);
            } else {
              failed++;
              results.push({ ...task, result: claimResult.message });
              logDetails.push(`  领取失败: ${claimResult.message}`);
            }
          } else {
            failed++;
            results.push({ ...task, result: execResult.message });
            logDetails.push(`  失败: ${execResult.message}`);
          }
        } catch (error) {
          failed++;
          results.push({ ...task, result: error.message });
          logDetails.push(`  异常: ${error.message}`);
        }

        await this.delay(500);
      }

      const summary = `帮派任务：完成${completed}个，失败${failed}个，跳过${skipped}个`;
      logDetails.unshift(summary);
      this.log(logDetails.join('\n'), failed === 0 ? 'success' : 'error');

      return this.success({
        result: summary,
        completed,
        failed,
        skipped,
        tasks: results,
      });
    } catch (error) {
      logDetails.push(`执行异常: ${error.message}`);
      this.log(logDetails.join('\n'), 'error');
      return this.fail(error.message);
    }
  }

  async executeVisitTask(params) {
    try {
      const cmd = params.cmd;
      if (!cmd) {
        return { success: false, message: '未配置访问命令' };
      }

      const html = await this.request(cmd, params.params || {});
      const text = this.extractText(html);

      if (text.includes('矿洞') || text.includes('帮战') || html.length > 100) {
        return { success: true, message: '访问成功' };
      }

      return { success: true, message: '已访问' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async executeItemTask(params) {
    try {
      const itemId = params.itemId;
      if (!itemId) {
        return { success: false, message: '未配置物品ID' };
      }

      if (itemId === 'contribution_potion') {
        const html = await this.request('store', { type: 2, page: 1 });
        const match = html.match(/cmd=useitem[^>]*id=(\d+)[^>]*>使用<\/a>[^<]*贡献药水/i) ||
                      html.match(/贡献药水[^<]*<a[^>]*cmd=useitem[^>]*id=(\d+)/i);

        if (match) {
          const potionId = match[1];
          const useHtml = await this.request('useitem', { id: potionId });
          const text = this.extractText(useHtml);

          if (text.includes('贡献') || text.includes('成功')) {
            return { success: true, message: '使用贡献药水成功' };
          }
          return { success: false, message: text.substring(0, 100) || '使用失败' };
        }

        return { success: false, message: '背包中没有贡献药水' };
      }

      return { success: false, message: `未知物品: ${itemId}` };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  extractTaskResult(html, taskName) {
    const text = this.extractText(html);

    if (text.includes('完成') || text.includes('成功')) {
      return { success: true, message: '任务完成' };
    }

    if (text.includes('已领取') || text.includes('获得')) {
      return { success: true, message: '已获得奖励' };
    }

    return { success: false, message: text.substring(0, 100) || '未完成' };
  }

  getAction(id) {
    const { getAction } = require('./index');
    return getAction(id);
  }

  async runOblation(logDetails) {
    const rawConfig = settings.get('oblation_items', []);
    logDetails.push(`原始配置数据：${JSON.stringify(rawConfig)}`);
    
    const configItemIds = Array.isArray(rawConfig) ? rawConfig : [];
    logDetails.push(`解析后配置：${configItemIds.join(', ')}, 数量：${configItemIds.length}`);
    
    if (this.getTodayOblationStatus()) {
      logDetails.push('检查供奉状态：今日已供奉');
      this.log(logDetails.join('\n'), 'success');
      return this.success({ message: '今日已供奉' });
    }

    logDetails.push('检查供奉状态：今日未供奉');

    if (configItemIds.length === 0) {
      logDetails.push('未配置供奉物品');
      this.log(logDetails.join('\n'), 'error');
      return this.fail('未配置供奉物品');
    }

    logDetails.push(`准备供奉 ${configItemIds.length} 个物品`);

    let successCount = 0;
    let failCount = 0;

    for (const itemId of configItemIds) {
      try {
        logDetails.push(`正在供奉物品 ID: ${itemId}`);
        const html = await this.request('oblation', { id: itemId, page: 1 });
        
        const textPreview = this.extractText(html).substring(0, 200);
        logDetails.push(`响应内容：${textPreview}`);
        
        if (html.includes('供奉成功') || html.includes('成功') || html.includes('获得')) {
          const match = html.match(/获得[^<\n]*/);
          const reward = match ? match[0] : '供奉成功';
          logDetails.push(`物品${itemId}: ${reward}`);
          successCount++;
        } else if (html.includes('不足') || html.includes('没有')) {
          logDetails.push(`物品${itemId}: 数量不足`);
          failCount++;
        } else {
          logDetails.push(`物品${itemId}: 供奉失败`);
          failCount++;
        }
        
        await this.delay(500);
      } catch (error) {
        logDetails.push(`物品${itemId}: 请求异常 - ${error.message}`);
        failCount++;
      }
    }

    if (successCount > 0) {
      this.markTodayOblated();
      logDetails.push(`供奉完成：成功${successCount}个，失败${failCount}个`);
      this.log(logDetails.join('\n'), 'success');
      return this.success({ message: '供奉成功' });
    } else {
      logDetails.push(`供奉失败：所有物品供奉失败`);
      this.log(logDetails.join('\n'), 'error');
      return this.fail('供奉失败');
    }
  }

  async run(params = {}) {
    const { action = 'all', itemIds = [], page = 1 } = params;
    const logDetails = [];

    try {
      if (action === 'tasks') {
        return this.runFactionTasks();
      }

      if (action === 'oblate') {
        return this.runOblation(logDetails);
      }

      if (action === 'all') {
        const oblateResult = await this.runOblation(logDetails);
        const tasksResult = await this.runFactionTasks();
        
        const summary = `帮派：${oblateResult.message || ''} | ${tasksResult.result || ''}`;
        this.log(summary, 'success');
        
        return this.success({
          result: summary,
          oblation: oblateResult,
          tasks: tasksResult,
        });
      }

      if (action === 'list') {
        const html = await this.request('viewolbation', { page });
        const items = this.parseOblationItems(html);
        logDetails.push(`供奉页面第${page}页: 找到${items.length}个物品`);
        items.forEach(item => {
          logDetails.push(`  ${item.name} (ID:${item.id}) 数量:${item.quantity}`);
        });
        this.log(logDetails.join('\n'), 'success');
        return this.success({ items, page });
      }

      if (action === 'config') {
        if (itemIds.length > 0) {
          this.setOblationConfig(itemIds);
          logDetails.push(`配置供奉物品：${itemIds.join(', ')}`);
          this.log(logDetails.join('\n'), 'success');
          return this.success({ message: '配置成功' });
        }
        
        const config = this.getOblationConfig();
        logDetails.push(`当前供奉配置：${config.length > 0 ? config.join(', ') : '未配置'}`);
        this.log(logDetails.join('\n'), 'success');
        return this.success({ itemIds: config });
      }

      if (action === 'list') {
        
        const config = this.getOblationConfig();
        logDetails.push(`当前供奉配置: ${config.length > 0 ? config.join(', ') : '未配置'}`);
        this.log(logDetails.join('\n'), 'success');
        return this.success({ itemIds: config });
      }

      const rawConfig = settings.get('oblation_items', []);
      logDetails.push(`原始配置数据: ${JSON.stringify(rawConfig)}`);
      
      const configItemIds = Array.isArray(rawConfig) ? rawConfig : [];
      logDetails.push(`解析后配置: ${configItemIds.join(', ')}, 数量: ${configItemIds.length}`);
      
      if (this.getTodayOblationStatus()) {
        logDetails.push('检查供奉状态: 今日已供奉');
        this.log(logDetails.join('\n'), 'success');
        return this.success({ message: '今日已供奉' });
      }

      logDetails.push('检查供奉状态: 今日未供奉');

      if (configItemIds.length === 0) {
        logDetails.push('未配置供奉物品');
        this.log(logDetails.join('\n'), 'error');
        return this.fail('未配置供奉物品');
      }

      logDetails.push(`准备供奉 ${configItemIds.length} 个物品`);

      let successCount = 0;
      let failCount = 0;

      for (const itemId of configItemIds) {
        try {
          logDetails.push(`正在供奉物品ID: ${itemId}`);
          const html = await this.request('oblation', { id: itemId, page: 1 });
          
          const textPreview = this.extractText(html).substring(0, 200);
          logDetails.push(`响应内容: ${textPreview}`);
          
          if (html.includes('供奉成功') || html.includes('成功') || html.includes('获得')) {
            const match = html.match(/获得[^<\n]*/);
            const reward = match ? match[0] : '供奉成功';
            logDetails.push(`物品${itemId}: ${reward}`);
            successCount++;
          } else if (html.includes('不足') || html.includes('没有')) {
            logDetails.push(`物品${itemId}: 数量不足`);
            failCount++;
          } else {
            logDetails.push(`物品${itemId}: 供奉失败`);
            failCount++;
          }
          
          await this.delay(500);
        } catch (error) {
          logDetails.push(`物品${itemId}: 请求异常 - ${error.message}`);
          failCount++;
        }
      }

      if (successCount > 0) {
        this.markTodayOblated();
        logDetails.push(`供奉完成: 成功${successCount}个, 失败${failCount}个`);
        this.log(logDetails.join('\n'), 'success');
        return this.success({ message: '供奉成功' });
      } else {
        logDetails.push(`供奉失败: 所有物品供奉失败`);
        this.log(logDetails.join('\n'), 'error');
        return this.fail('供奉失败');
      }
    } catch (error) {
      logDetails.push(`执行异常: ${error.message}`);
      this.log(logDetails.join('\n'), 'error');
      return this.fail(error.message);
    }
  }
}

module.exports = {
  FactionAction,
  action: new FactionAction(),
};