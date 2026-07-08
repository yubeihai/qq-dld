const { SessionLogger } = require('../core/session-logger');
const { ErrorHandler, AppError, ERROR_CODES } = require('../core/error-handler');
const { TaskStateMachine, STATES } = require('./task-state-machine');
const { TaskContext } = require('./task-context');
const { TaskResult } = require('./task-result');
const { registry } = require('../modules/registry');
const { taskTypes, taskConfigs } = require('../db');

const DEFAULT_REPLACE_CONFIG = { actionType: 'replace' };
const DEFAULT_SKIP_CONFIG = { actionType: 'skip' };
const DEFAULT_EXECUTE_CONFIG = (moduleId) => ({ actionType: 'module', actionModule: moduleId });

class TaskEngine {
  constructor(options = {}) {
    this.registry = options.registry || registry;
    this.taskTypesRepo = options.taskTypesRepo || taskTypes;
    this.taskConfigsRepo = options.taskConfigsRepo || taskConfigs;
    this.eh = new ErrorHandler();
    this.onRequestCallback = options.onRequestCallback || null;
  }

  async executeAll(tasks, options = {}) {
    const source = options.source || 'manual';
    const context = new TaskContext({
      source,
      maxReplaces: options.maxReplaces || 3,
    });

    const logger = new SessionLogger('task', '日常任务', source);
    logger.start({ taskCount: tasks.length, ...options });
    context.logger = logger;

    if (this.onRequestCallback) {
      const originalLogStep = context.logStep.bind(context);
      context.logRequest = (cmd, url, statusCode, reqSize, resSize, durationMs, retryCount = 0, error = '') => {
        logger.request(cmd, url, statusCode, reqSize, resSize, durationMs, retryCount, error);
      };
    }

    const result = new TaskResult();
    context.results.total = tasks.length;

    for (const task of tasks) {
      const stepStart = Date.now();
      try {
        const taskResult = await this.executeTask(task, context);
        result.add(task.id, task.name, taskResult.status, taskResult.message, taskResult.detail);
        context.recordResult(taskResult.status);
      } catch (error) {
        const elapsed = Date.now() - stepStart;
        result.add(task.id, task.name, 'failed', `执行异常: ${error.message}`);
        context.recordResult('failed');
        context.addError(error);
        context.logStep('execute', task.name, 'failed', {}, error.message, elapsed);
      }
    }

    const summary = context.getSummary();
    const finalStatus = context.getStatus();

    logger.end(finalStatus, summary);

    return {
      success: context.isAllSuccess(),
      status: finalStatus,
      summary,
      results: result.items,
      sessionId: logger.sessionId,
    };
  }

  async executeTask(task, context) {
    const sm = new TaskStateMachine(task);
    const stepStart = Date.now();

    if (sm.state === STATES.DONE) {
      context.logStep('check', task.name, 'done', { reason: '任务已完成' }, '', 0);
      return { status: 'done', message: '已完成' };
    }

    if (sm.state === STATES.CAN_CLAIM) {
      const elapsed = Date.now() - stepStart;
      context.logStep('check', task.name, 'can_claim', { reason: '可领取奖励' }, '', elapsed);
      return { status: 'can_claim', message: '可领取奖励' };
    }

    const config = await this.resolveTaskConfig(task);

    switch (config.actionType) {
      case 'skip':
        sm.transition(STATES.SKIPPED, '用户配置为跳过');
        const elapsed1 = Date.now() - stepStart;
        context.logStep('decision', task.name, 'skipped', { config, reason: '用户配置跳过' }, '', elapsed1);
        return { status: 'skipped', message: '已跳过', detail: { config } };

      case 'replace':
        if (context.canReplace()) {
          const replaceResult = await this.handleReplace(task, context, sm);
          return replaceResult;
        } else {
          sm.transition(STATES.FAILED, '替换次数已达上限');
          const elapsed2 = Date.now() - stepStart;
          context.logStep('decision', task.name, 'failed', { reason: '替换次数上限' }, '', elapsed2);
          return { status: 'failed', message: '替换次数已达上限' };
        }

      case 'module':
        return await this.handleExecuteModule(task, config.actionModule, context, sm, stepStart);

      default:
        sm.transition(STATES.FAILED, '未知的操作类型');
        return { status: 'failed', message: `未知的操作类型: ${config.actionType}` };
    }
  }

  async handleReplace(task, context, sm) {
    const stepStart = Date.now();
    const replaced = await this.replaceTask(task);

    if (replaced) {
      const newCount = context.incrementReplaceCount();
      context.logStep('replace', task.name, 'replaced', { replaceCount: newCount }, '', Date.now() - stepStart);
      sm.transition(STATES.REPLACED, `替换成功，已替换${newCount}次`);
      return { status: 'replaced', message: '替换成功', detail: { replaceCount: newCount } };
    } else {
      sm.transition(STATES.FAILED, '替换失败');
      context.logStep('replace', task.name, 'failed', {}, '替换失败', Date.now() - stepStart);
      return { status: 'failed', message: '替换失败' };
    }
  }

  async handleExecuteModule(task, moduleId, context, sm, stepStart) {
    const action = this.registry.get(moduleId);
    if (!action) {
      sm.transition(STATES.FAILED, `模块 ${moduleId} 不存在`);
      const elapsed = Date.now() - stepStart;
      context.logStep('module', task.name, 'failed', { moduleId }, `模块不存在`, elapsed);
      return { status: 'failed', message: `模块 ${moduleId} 不存在` };
    }

    try {
      const moduleResult = await action.run({});
      const elapsed = Date.now() - stepStart;

      if (moduleResult && moduleResult.success) {
        sm.transition(STATES.COMPLETED, `模块执行成功`);
        context.logStep('module', task.name, 'completed', { moduleId, result: moduleResult }, '', elapsed);
        return { status: 'completed', message: '执行成功', detail: { moduleId } };
      } else {
        const errorMsg = moduleResult?.error || '执行失败';
        sm.transition(STATES.FAILED, errorMsg);
        context.logStep('module', task.name, 'failed', { moduleId }, errorMsg, elapsed);
        return { status: 'failed', message: errorMsg, detail: { moduleId } };
      }
    } catch (error) {
      const elapsed = Date.now() - stepStart;
      sm.transition(STATES.FAILED, error.message);
      context.logStep('module', task.name, 'failed', { moduleId }, error.message, elapsed);
      return { status: 'failed', message: `执行异常: ${error.message}` };
    }
  }

  async replaceTask(task) {
    try {
      const html = await require('../core/game-client').client.request('task', { sub: 3, id: task.id });
      return html && !html.includes('系统繁忙');
    } catch {
      return false;
    }
  }

  async resolveTaskConfig(task) {
    const dbConfig = this.taskConfigsRepo.getByTaskId(String(task.id));
    if (dbConfig) {
      return {
        actionType: dbConfig.action_type || 'replace',
        actionModule: dbConfig.action_module || '',
        fromDb: true,
      };
    }

    const matchedModule = this.matchModuleByTaskName(task.name);
    if (matchedModule) {
      return {
        actionType: 'module',
        actionModule: matchedModule,
        autoMatched: true,
        fromDb: false,
      };
    }

    return {
      actionType: 'replace',
      actionModule: '',
      autoMatched: false,
      fromDb: false,
    };
  }

  matchModuleByTaskName(taskName) {
    if (!taskName) return null;

    const taskModuleMap = {
      '乐斗好友': 'friendfight',
      '好友': 'friendfight',
      '侠友': 'friendfight',
      '俊猴王': 'friendfight',
      '金毛鹅王': 'friendfight',
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
      '商会': 'callbackrecall',
      '每日奖励': 'dailygift',
      '签到': 'dailygift',
      '领取': 'dailygift',
      '抽奖': 'tenlottery',
      '商城': 'store',
      '商店': 'store',
      '强化神装': 'store',
      '镶嵌': 'store',
      '镖车': 'cargo',
      '押镖': 'cargo',
      '缥缈幻境': 'misty',
      '世界树': 'worldtree',
      '福宝': 'worldtree',
      '源宝': 'worldtree',
      '画卷': 'scrolldungeon',
      '门派': 'sect',
      '五花堂': 'sect',
      '金顶': 'sect',
      '龙凰': 'dragonphoenix',
      '侠客岛': 'knightisland',
      '群侠': 'knightfight',
      '深渊': 'abysstide',
      '巅峰': 'peakfight',
      '登天': 'ascendheaven',
      '附魔': 'enchant',
      '祭坛': 'altar',
      '许愿': 'wish',
      '神仙': 'immortals',
      '活跃度': 'livenessgift',
      '徽章': 'badgehall',
      '江湖长梦': 'jianghudream',
      '酒馆': 'warriorinn',
      '武林盟主': 'wulinmengzhu',
    };

    for (const [keyword, moduleId] of Object.entries(taskModuleMap)) {
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

      const completeRegex = new RegExp(`cmd=task[^"]*sub=4[^"]*id=${id}[^"]*"`);
      const hasCompleteLink = completeRegex.test(decodedHtml);

      const replaceRegex = new RegExp(`cmd=task[^"]*sub=3[^"]*id=${id}[^"]*"`);
      const hasReplaceLink = replaceRegex.test(decodedHtml);

      let status;
      if (hasCompleteLink) {
        status = 'can_claim';
      } else if (hasReplaceLink) {
        status = 'pending';
      } else {
        status = 'done';
      }

      if (!tasks.some(t => t.id === id)) {
        tasks.push({ id, name, canReplace: hasReplaceLink, status });
      }
    }

    const hasOneKeyComplete = decodedHtml.includes('cmd=task&sub=8');

    return { tasks, hasOneKeyComplete };
  }

  async getTaskList() {
    const html = await require('../core/game-client').client.request('task', { sub: 5 });
    return this.parseTaskList(html);
  }

  async oneKeyComplete() {
    const html = await require('../core/game-client').client.request('task', { sub: 8 });
    return { success: true, html };
  }
}

const taskEngine = new TaskEngine();

module.exports = { TaskEngine, taskEngine };
