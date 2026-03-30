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

  extractResult(html) {
    if (!html) return { success: false, message: '无响应' };
    
    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期' };
    }
    
    if (html.includes('领取成功') || html.includes('恭喜') || html.includes('获得')) {
      const match = html.match(/获得[^<\n]*/);
      return { success: true, message: match ? match[0] : '领取成功' };
    }
    
    if (html.includes('已领取') || html.includes('已经领取')) {
      return { success: true, message: '已领取' };
    }
    
    if (html.includes('未完成')) {
      return { success: false, message: '任务未完成' };
    }
    
    if (html.includes('系统繁忙')) {
      return { success: false, message: '系统繁忙' };
    }
    
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
        const result = this.extractResult(html);
        
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