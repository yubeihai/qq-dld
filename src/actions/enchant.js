const { ActionBase } = require('../core/action-base');

class EnchantAction extends ActionBase {
  constructor() {
    super({
      id: 'enchant',
      name: '器魂附魔',
      description: '领取附魔任务活跃度奖励',
      category: '每日任务',
    });
  }

  extractResult(html, taskId) {
    if (!html) return { success: false, message: '无响应' };
    
    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期' };
    }
    
    // 先检查是否获得奖励（领取成功的响应）
    if (html.includes('领取成功') || html.includes('恭喜') || html.includes('获得')) {
      const match = html.match(/获得[^<\n]*/);
      return { success: true, message: match ? match[0] : '领取成功' };
    }
    
    // 检查系统繁忙
    if (html.includes('系统繁忙')) {
      return { success: false, message: '系统繁忙' };
    }
    
    // 精确匹配任务状态：查找任务行的状态文本
    // 任务状态格式："日活跃度达到XX  已领取/领取/未完成"
    // 或在链接中："日活跃度达到XX&nbsp;&nbsp;<a href="...&task_id=X">领取</a>"
    
    // 构建匹配模式：查找包含当前 task_id 的链接或状态文本
    const taskLinkPattern = new RegExp(`<a[^>]*task_id=${taskId}[^>]*>领取</a>`);
    const hasTaskLink = taskLinkPattern.test(html);
    
    // 如果有领取链接，说明任务已完成且可领取
    if (hasTaskLink) {
      return { success: false, message: '待领取' };
    }
    
    // 查找活跃度任务状态（匹配整个任务行）
    // 格式示例：
    // - "日活跃度达到50&nbsp;&nbsp; 已领取"（已领取）
    // - "日活跃度达到80&nbsp;&nbsp;<a ...task_id=2>领取</a>"（可领取）
    // - "日活跃度达到115&nbsp;&nbsp; 未完成"（未完成）
    
    // 先尝试精确匹配：查找该 task_id 对应的状态文本
    const livenessMap = { 1: '50', 2: '80', 3: '115' };
    const liveness = livenessMap[taskId];
    
    if (liveness) {
      // 匹配任务行（可能包含&nbsp;、空格等）
      const taskLinePattern = new RegExp(
        `日活跃度达到${liveness}[^<]*((?:<a[^>]*>领取</a>)|(?:已领取)|(?:未完成))`,
        'i'
      );
      const taskLineMatch = html.match(taskLinePattern);
      
      if (taskLineMatch) {
        const statusText = taskLineMatch[1];
        if (statusText.includes('领取</a>')) {
          return { success: false, message: '待领取' };
        } else if (statusText.includes('已领取')) {
          return { success: true, message: '已领取' };
        } else if (statusText.includes('未完成')) {
          return { success: false, message: '任务未完成' };
        }
      }
      
      // 如果没匹配到具体任务行，尝试更宽松的匹配（查找该活跃度附近的状态）
      const loosePattern = new RegExp(`日活跃度达到${liveness}[^\\n]*`);
      const looseMatch = html.match(loosePattern);
      
      if (looseMatch) {
        const line = looseMatch[0];
        if (line.includes('未完成')) {
          return { success: false, message: '任务未完成' };
        } else if (line.includes('<a') && line.includes('领取')) {
          return { success: false, message: '待领取' };
        } else if (line.includes('已领取')) {
          return { success: true, message: '已领取' };
        }
      }
    }
    
    // 兜底：如果整个页面都没找到领取链接，但有已领取文本，可能是真的已领取
    // 但这种情况应该在上面的精确匹配中已经处理了
    
    return { success: false, message: '未知结果' };
  }

  async run(params = {}) {
    const results = [];
    let successCount = 0;
    let failCount = 0;

    try {
      const html = await this.request('enchant', { op: 'index' });
      if (!html || html.includes('ptlogin2.qq.com')) {
        return this.fail('登录已过期，请重新扫码登录');
      }
    } catch (error) {
      return this.fail(error.message);
    }

    const tasks = [
      { task_id: 1, name: '日活跃度50' },
      { task_id: 2, name: '日活跃度80' },
      { task_id: 3, name: '日活跃度115' },
    ];

    for (const task of tasks) {
      try {
        await this.delay(500);
        const html = await this.request('enchant', { 
          op: 'gettaskreward', 
          task_id: task.task_id 
        });
        const result = this.extractResult(html, task.task_id);
        
        results.push({
          task_id: task.task_id,
          name: task.name,
          success: result.success,
          message: result.message,
        });
        
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        results.push({
          task_id: task.task_id,
          name: task.name,
          success: false,
          message: error.message,
        });
        failCount++;
      }
    }

    const summary = `器魂附魔任务：成功${successCount}个，失败${failCount}个`;
    const details = results.map(r => `${r.name}: ${r.message}`).join('\n');
    
    this.log(`${summary}\n${details}`, failCount === 0 ? 'success' : 'error');

    return this.success({
      result: summary,
      tasks: results,
      successCount,
      failCount,
    });
  }
}

module.exports = {
  EnchantAction,
  action: new EnchantAction(),
};