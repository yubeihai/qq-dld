const { ActionBase } = require('../core/action-base');
const { taskTypes, taskConfigs, moduleConfigs } = require('../db');

class TaskAction extends ActionBase {
  constructor() {
    super({
      id: 'task',
      name: '日常任务',
      description: '自动完成日常任务，根据配置执行模块或替换任务',
      category: '每日任务',
    });
    this.defaultInterval = 1000;
    
    this.taskModuleMap = {
      '乐斗好友': 'friendfight',
      '好友': 'friendfight',
      '侠友': 'friendfight',
      '挑战俊猴王': 'friendfight',
      '挑战金毛鹅王': 'friendfight',
      '俊猴王': 'friendfight',
      '金毛鹅王': 'friendfight',
      '师徒切磋': 'friendfight',
      '师徒': 'friendfight',
      '师门': 'friendfight',
      '帮派': 'friendfight',
      '帮友': 'friendfight',
      '天界十二宫': 'zodiac',
      '十二宫': 'zodiac',
      '历练': 'adventure',
      '冒险': 'adventure',
      '武林大会': 'wulin',
      '武林': 'wulin',
      '斗神塔': 'towerfight',
      '爬塔': 'towerfight',
      '骑士': 'knightfight',
      '商会任务': 'callbackrecall',
      '商会': 'callbackrecall',
      '每日奖励': 'dailygift',
      '签到': 'dailygift',
      '领取': 'dailygift',
      '抽奖': 'tenlottery',
      '商城': 'store',
      '商店': 'store',
      '购买': 'store',
      '强化神装': 'store',
      '镶嵌': 'store',
    };
  }

  getAction(id) {
    const { getAction } = require('./index');
    return getAction(id);
  }

  matchModuleByTaskName(taskName) {
    for (const [keyword, moduleId] of Object.entries(this.taskModuleMap)) {
      if (taskName.includes(keyword)) {
        return moduleId;
      }
    }
    return null;
  }

  parseTaskList(html) {
    if (!html) return { tasks: [], hasOneKeyComplete: false };

    const tasks = [];
    const decodedHtml = html.replace(/&amp;/g, '&');

    const taskRegex = /cmd=task[^"]*sub=5[^"]*id=(\d+)[^"]*"[^>]*>([^<]+)<\/a>/gi;
    let match;

    while ((match = taskRegex.exec(decodedHtml)) !== null) {
      const id = match[1];
      const name = match[2].trim();

      const completeRegex = new RegExp(`cmd=task[^"]*sub=4[^"]*id=${id}[^"]*"`, 'i');
      const hasCompleteLink = completeRegex.test(decodedHtml);

      const replaceRegex = new RegExp(`cmd=task[^"]*sub=3[^"]*id=${id}[^"]*"`, 'i');
      const hasReplaceLink = replaceRegex.test(decodedHtml);

      let status;
      if (hasCompleteLink) {
        status = 'can_claim';
      } else if (hasReplaceLink) {
        status = 'pending';
      } else {
        status = 'done';
      }

      const taskAlreadyExists = tasks.some(t => t.id === id);
      if (!taskAlreadyExists) {
        tasks.push({
          id,
          name,
          canReplace: hasReplaceLink,
          status,
        });
      }
    }

    const hasOneKeyComplete = decodedHtml.includes('cmd=task') && decodedHtml.includes('sub=7');

    return { tasks, hasOneKeyComplete };
  }

  extractTaskResult(html) {
    if (!html) return { success: false, message: '无响应' };

    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期，请重新扫码登录' };
    }

    if (html.includes('任务替换成功') || html.includes('更换当前任务成功')) {
      return { success: true, message: '替换成功', isReplace: true };
    }

    if (html.includes('更换当前任务需要消耗')) {
      return { success: false, message: '需要确认替换', needConfirm: true };
    }

    if (html.includes('不能替换') || html.includes('无法替换') || html.includes('替换次数已用完')) {
      return { success: false, message: '无法替换' };
    }

    if (html.includes('次数不足') || html.includes('没有次数')) {
      return { success: false, message: '次数不足' };
    }

    if (html.includes('活力不足') || html.includes('体力不足')) {
      return { success: false, message: '体力不足' };
    }

    if (html.includes('系统繁忙')) {
      return { success: false, message: '系统繁忙' };
    }

    const taskCompleteMatch = html.match(/完成任务[：:（(]([^）)]+)[）)][^。<]*[。<]/);
    if (taskCompleteMatch) {
      return { success: true, message: taskCompleteMatch[0] };
    }

    const rewardMatch = html.match(/获得(\d+)经验/);
    if (rewardMatch) {
      return { success: true, message: `获得${rewardMatch[0]}` };
    }

    return { success: false, message: '任务未完成' };
  }

  async getTaskList() {
    const html = await this.request('task', { sub: '1' });
    if (html.includes('ptlogin2.qq.com')) {
      throw new Error('登录已过期，请重新扫码登录');
    }
    return this.parseTaskList(html);
  }

  checkTaskCompleted(html, taskId) {
    const idStr = String(taskId);
    const completeRegex = new RegExp(`cmd=task[^"]*sub=4[^"]*id=${idStr}[^"]*"`, 'i');
    return completeRegex.test(html);
  }

  async claimTaskReward(taskId) {
    const listHtml = await this.request('task', { sub: '1' });
    
    if (this.checkTaskCompleted(listHtml, taskId)) {
      const claimHtml = await this.request('task', { sub: '4', id: String(taskId) });
      const taskCompleteMatch = claimHtml.match(/完成任务[：:（(]([^）)]+)[）)][^。<]*[。<]/);
      if (taskCompleteMatch) {
        return { success: true, message: taskCompleteMatch[0] };
      }
      const rewardMatch = claimHtml.match(/获得(\d+)经验/);
      if (rewardMatch) {
        return { success: true, message: `获得${rewardMatch[0]}` };
      }
      return { success: true, message: '已领取奖励' };
    }
    
    return { success: false, message: '任务未完成' };
  }

  async executeTaskAction(taskId) {
    const html = await this.request('task', { sub: '5', id: String(taskId) });
    return this.extractTaskResult(html);
  }

  async completeTask(taskId) {
    const html = await this.request('task', { sub: '4', id: String(taskId) });
    return this.extractTaskResult(html);
  }

  async replaceTask(taskId) {
    let html = await this.request('task', { sub: '3', id: String(taskId) });
    
    if (html.includes('confirm=1')) {
      html = await this.request('task', { sub: '3', confirm: '1', id: String(taskId) });
    }
    
    const result = this.extractTaskResult(html);
    return result;
  }

  async completeAll() {
    const html = await this.request('task', { sub: '7' });
    const text = this.extractText(html);
    
    if (text.includes('完成') || text.includes('成功')) {
      return { success: true, message: '一键完成成功' };
    }
    
    return { success: false, message: '一键完成失败', raw: text.substring(0, 200) };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getTaskConfig(taskId, taskName = '') {
    const config = taskConfigs.getByTaskId(String(taskId));
    if (config) {
      this.log(`[任务配置] ${taskName}(ID:${taskId}) 从数据库读取: type=${config.action_type}, module=${config.action_module}`, 'info');
      return {
        actionType: config.action_type,
        actionModule: config.action_module || '',
        fromDb: true,
      };
    }
    
    const matchedModule = this.matchModuleByTaskName(taskName);
    if (matchedModule) {
      this.log(`[任务配置] ${taskName}(ID:${taskId}) 自动匹配模块: ${matchedModule}`, 'info');
      return {
        actionType: 'module',
        actionModule: matchedModule,
        autoMatched: true,
      };
    }
    
    this.log(`[任务配置] ${taskName}(ID:${taskId}) 无配置，默认替换`, 'info');
    return { actionType: 'replace', actionModule: '' };
  }

  getModuleParams(moduleId) {
    const config = moduleConfigs.getById(moduleId);
    if (config && config.extra_data) {
      try {
        return JSON.parse(config.extra_data);
      } catch (e) {
        return {};
      }
    }
    return {};
  }

  saveTaskTypes(tasks) {
    if (tasks.length > 0) {
      taskTypes.upsertBatch(tasks.map(t => ({ id: t.id, name: t.name })));
    }
  }

  async run(params = {}) {
    const {
      mode = 'auto',
      taskId = null,
      interval = this.defaultInterval,
    } = params;

    if (mode === 'all') {
      const result = await this.completeAll();
      this.log(result.message, result.success ? 'success' : 'error');
      return result.success
        ? this.success({ result: result.message, mode: 'all' })
        : this.fail(result.message);
    }

    if (mode === 'single' && taskId) {
      let result = await this.claimTaskReward(taskId);
      
      if (result.success && !result.isReplace) {
        this.log(`任务${taskId}: ${result.message}`, 'success');
        return this.success({ result: result.message, taskId });
      }
      
      const config = this.getTaskConfig(taskId);
      
      if (config.actionType === 'module' && config.actionModule) {
        const action = this.getAction(config.actionModule);
        if (action) {
          try {
            this.log(`执行模块 ${config.actionModule}...`, 'info');
            const moduleParams = this.getModuleParams(config.actionModule);
            const moduleResult = await action.run(moduleParams);
            if (moduleResult.success) {
              await this.sleep(interval);
              result = await this.claimTaskReward(taskId);
            } else {
              result = { success: false, message: `模块执行失败: ${moduleResult.error || '未知错误'}` };
            }
          } catch (error) {
            result = { success: false, message: `模块执行异常: ${error.message}` };
          }
        } else {
          result = { success: false, message: `模块 ${config.actionModule} 不存在` };
        }
      } else if (config.actionType === 'skip') {
        result = { success: false, message: '任务已设置为跳过' };
      } else {
        result = await this.replaceTask(taskId);
      }
      
      this.log(`任务${taskId}: ${result.message}`, result.success ? 'success' : 'error');
      return result.success
        ? this.success({ result: result.message, taskId })
        : this.fail(result.message);
    }

let { tasks } = await this.getTaskList();
    
    if (tasks.length === 0) {
      this.log('没有可执行的任务', 'error');
      return this.fail('没有可执行的任务');
    }

    this.saveTaskTypes(tasks);

    const results = [];
    let completed = 0;
    let failed = 0;
    let replaced = 0;
    let skipped = 0;
    const MAX_GLOBAL_REPLACES = 3;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      let config = this.getTaskConfig(task.id, task.name);

      if (task.status === 'done') {
        this.log(`[${task.name}] 已完成，跳过`, 'info');
        task.message = '已完成';
        skipped++;
        results.push(task);
        continue;
      }

      if (task.status === 'can_claim') {
        this.log(`[${task.name}] 任务已完成，领取奖励...`, 'info');
        const claimResult = await this.claimTaskReward(task.id);
        
        if (claimResult.success) {
          task.status = 'done';
          task.message = claimResult.message || '已领取奖励';
          completed++;
        } else {
          task.status = 'failed';
          task.message = `领取失败: ${claimResult.message}`;
          failed++;
        }
        results.push(task);
        if (i < tasks.length - 1) await this.sleep(interval);
        continue;
      }

      if (task.status === 'pending') {
        this.log(`[${task.name}] 任务未完成，处理中...`, 'info');

        if (!config.actionModule) {
          const matchedModule = this.matchModuleByTaskName(task.name);
          if (matchedModule) {
            config = {
              ...config,
              actionModule: matchedModule,
              autoMatched: true,
            };
          }
        }

        if (!config.actionModule && task.canReplace && replaced < MAX_GLOBAL_REPLACES) {
          this.log(`[${task.name}] 无法执行，尝试替换任务...`, 'info');
          const replaceResult = await this.replaceTask(task.id);
          
          if (replaceResult.success) {
            replaced++;
            task.replaced = true;
            task.replaceCount = 1;
            await this.sleep(interval);
            
            const newTaskList = await this.getTaskList();
            const newTask = newTaskList.tasks.find(t => t.id === task.id);
            if (newTask) {
              task.name = newTask.name;
              task.status = newTask.status;
              task.canReplace = newTask.canReplace;
            }
            
            config = this.getTaskConfig(task.id, task.name);
            if (!config.actionModule) {
              const matchedModule = this.matchModuleByTaskName(task.name);
              if (matchedModule) {
                config = {
                  ...config,
                  actionModule: matchedModule,
                  autoMatched: true,
                };
              }
            }
            
            if (task.status === 'can_claim') {
              this.log(`[${task.name}] 替换后任务已完成，领取奖励...`, 'info');
              const claimResult = await this.claimTaskReward(task.id);
              if (claimResult.success) {
                task.status = 'done';
                task.message = claimResult.message || '已领取奖励';
                completed++;
              } else {
                task.status = 'failed';
                task.message = `领取失败: ${claimResult.message}`;
                failed++;
              }
              results.push(task);
              if (i < tasks.length - 1) await this.sleep(interval);
              continue;
            }
          } else {
            task.status = 'failed';
            task.message = `替换失败: ${replaceResult.message}`;
            failed++;
            results.push(task);
            if (i < tasks.length - 1) await this.sleep(interval);
            continue;
          }
        }

        if (!config.actionModule) {
          task.status = 'failed';
          task.message = config.actionType === 'skip' ? '已跳过' : '无匹配模块';
          if (config.actionType === 'skip') {
            skipped++;
          } else {
            failed++;
          }
          results.push(task);
          if (i < tasks.length - 1) await this.sleep(interval);
          continue;
        }

        const action = this.getAction(config.actionModule);
        
        if (!action) {
          task.status = 'failed';
          task.message = `模块 ${config.actionModule} 不存在`;
          failed++;
          results.push(task);
          if (i < tasks.length - 1) await this.sleep(interval);
          continue;
        }

        try {
          const matchInfo = config.autoMatched ? '(自动匹配)' : '';
          this.log(`[${task.name}] 执行模块 ${config.actionModule}${matchInfo}...`, 'info');
          const moduleParams = this.getModuleParams(config.actionModule);
          const moduleResult = await action.run(moduleParams);
          
          await this.sleep(interval);
          
          const newTaskList = await this.getTaskList();
          const newTask = newTaskList.tasks.find(t => t.id === task.id);
          
          if (newTask) {
            task.status = newTask.status;
            task.name = newTask.name;
          }
          
          if (task.status === 'can_claim') {
            this.log(`[${task.name}] 模块执行成功，领取奖励...`, 'info');
            const claimResult = await this.claimTaskReward(task.id);
            
            if (claimResult.success) {
              task.status = 'done';
              task.message = claimResult.message || '已领取奖励';
              completed++;
            } else {
              task.status = 'failed';
              task.message = `领取失败: ${claimResult.message}`;
              failed++;
            }
          } else if (task.status === 'done') {
            task.message = '已完成';
            completed++;
          } else {
            task.status = 'failed';
            task.message = moduleResult.error || '模块执行后任务未完成';
            failed++;
          }
        } catch (error) {
          task.status = 'failed';
          task.message = `执行异常: ${error.message}`;
          failed++;
        }
      }

      results.push(task);

      if (i < tasks.length - 1) {
        await this.sleep(interval);
      }
    }

    let summary = `日常任务：完成${completed}个，失败${failed}个`;
    if (replaced > 0) summary += `，替换${replaced}个`;
    if (skipped > 0) summary += `，跳过${skipped}个`;

    const details = results.map(r => {
      let line = `${r.name}(ID:${r.id}): `;
      if (r.status === 'done') {
        line += '✅ 完成';
      } else if (r.status === 'replaced') {
        line += '🔄 已替换';
      } else if (r.status === 'skipped') {
        line += '⏭️ 跳过';
      } else {
        line += `❌ ${r.message || '失败'}`;
      }
      if (r.replaced) {
        line += ` (替换${r.replaceCount}次)`;
      }
      return line;
    }).join('\n');

    this.log(`${summary}\n${details}`, failed === 0 ? 'success' : 'error');

    return this.success({
      result: summary,
      total: tasks.length,
      completed,
      failed,
      replaced,
      skipped,
      tasks: results,
    });
  }
}

module.exports = {
  TaskAction,
  action: new TaskAction(),
};