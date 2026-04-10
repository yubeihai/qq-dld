const { ActionBase } = require('../core/action-base');

class ImmortalsAction extends ActionBase {
  constructor() {
    super({
      id: 'immortals',
      name: '仙武修真',
      description: '寻访仙山（长留山、蓬莱山、未名山），领取任务奖励',
      category: '每日任务',
    });
  }

  extractVisitResult(html, mountainName) {
    if (!html) return { success: false, message: '无响应', raw: '' };
    
    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期，请重新扫码登录', raw: '' };
    }
    
    if (html.includes('挑战次数不足') || html.includes('次数不足') || html.includes('没有挑战次数')) {
      return { success: false, message: '挑战次数不足', raw: '' };
    }
    
    if (html.includes('寻访成功')) {
      const match = html.match(/本次寻访：[^\s<]*?>([^<]+)/);
      const immortal = match ? match[1] : '未知仙人';
      return { success: true, message: `寻访成功：${immortal}`, raw: '' };
    }
    
    if (html.includes('系统繁忙')) {
      return { success: false, message: '系统繁忙，请稍后重试', raw: '' };
    }
    
    const text = this.extractText(html).substring(0, 200);
    return { success: false, message: '未知结果', raw: text };
  }

  extractFightResult(html) {
    if (!html) return { success: false, message: '无响应', raw: '' };
    
    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期，请重新扫码登录', raw: '' };
    }
    
    if (html.includes('挑战成功') || html.includes('击败') || html.includes('胜利')) {
      const match = html.match(/获得[^<\n]*/);
      return { success: true, message: match ? match[0] : '挑战成功', raw: '' };
    }
    
    if (html.includes('挑战失败') || html.includes('输了')) {
      const match = html.match(/获得[^<\n]*/);
      return { success: true, message: match ? `挑战失败：${match[0]}` : '挑战失败', raw: '' };
    }
    
    if (html.includes('系统繁忙')) {
      return { success: false, message: '系统繁忙，请稍后重试', raw: '' };
    }
    
    const text = this.extractText(html).substring(0, 200);
    return { success: false, message: '未知结果', raw: text };
  }

  extractTaskResult(html, taskId) {
    if (!html) return { success: false, message: '无响应', raw: '' };
    
    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期，请重新扫码登录', raw: '' };
    }
    
    if (html.includes('领取成功') || html.includes('恭喜获得')) {
      const match = html.match(/获得[^<\n]*/);
      return { success: true, message: match ? match[0] : '领取成功', raw: '' };
    }
    
    if (html.includes('已领取') || html.includes('已经领取')) {
      return { success: true, message: '已领取', raw: '' };
    }
    
    if (html.includes('条件未达成') || html.includes('未达到条件')) {
      return { success: false, message: '任务条件未达成', raw: '' };
    }
    
    if (html.includes('系统繁忙')) {
      return { success: false, message: '系统繁忙，请稍后重试', raw: '' };
    }
    
    const text = this.extractText(html).substring(0, 200);
    return { success: false, message: '未知结果', raw: text };
  }

  async run(params = {}) {
    const results = [];
    let successCount = 0;
    let failCount = 0;

    let html;
    try {
      html = await this.request('immortals', { op: 'findimmortals' });
      if (!html || html.includes('ptlogin2.qq.com')) {
        return this.fail('登录已过期，请重新扫码登录');
      }
    } catch (error) {
      return this.fail(error.message);
    }

    // 先领取任务奖励（活跃度等任务奖励可能会增加挑战次数）
    const tasks = [
      { taskId: 1, name: '日活跃度达到 80' },
      { taskId: 2, name: '今日消耗 1 鹅币' },
      { taskId: 3, name: '今日消耗 5 鹅币' },
    ];

    for (const task of tasks) {
      try {
        const taskHtml = await this.request('immortals', { 
          op: 'getreward', 
          taskid: task.taskId 
        });
        const result = this.extractTaskResult(taskHtml, task.taskId);
        
        results.push({
          name: `任务：${task.name}`,
          success: result.success,
          message: result.message,
          raw: result.raw,
        });
        
        if (result.success && result.message !== '已领取') {
          successCount++;
        } else if (!result.success && !result.message.includes('未达成') && !result.message.includes('未达到')) {
          failCount++;
        }
        
        await this.delay(1000);
      } catch (error) {
        results.push({
          name: `任务：${task.name}`,
          success: false,
          message: error.message,
          raw: '',
        });
        failCount++;
      }
    }

    // 领取任务奖励后，重新获取挑战次数
    await this.delay(2000);
    let remainingChallenges = 0;
    try {
      html = await this.request('immortals', { op: 'findimmortals' });
      const challengeMatch = html.match(/剩余挑战次数：(\d+)/);
      if (challengeMatch) {
        remainingChallenges = parseInt(challengeMatch[1], 10);
      }
    } catch (error) {
      // 忽略错误，继续
    }

    if (remainingChallenges <= 0) {
      const summary = '仙武修真：领取任务奖励完成，没有剩余挑战次数';
      this.log(summary, 'success');
      return this.success({ result: summary, challengesUsed: 0, results });
    }

    // 检查是否已有可挑战的仙人（之前寻访过但未挑战）
    let hasPendingImmortal = html.includes('本次寻访') && html.includes('挑战');
    let visitCount = 0;

    // 循环寻访并挑战，直到次数用光
    let challengesUsed = 0;
    while (remainingChallenges > 0) {
      try {
        // 如果没有待挑战的仙人，先寻访
        if (!hasPendingImmortal) {
          // 随机选择一座山寻访（mountainId: 1=长留山, 2=蓬莱山, 3=未名山）
          const mountainId = Math.floor(Math.random() * 3) + 1;
          const visitHtml = await this.request('immortals', { 
            op: 'visitimmortals', 
            mountainId: mountainId 
          });
          const visitResult = this.extractVisitResult(visitHtml);
          
          if (!visitResult.success) {
            results.push({
              name: '寻访',
              success: false,
              message: visitResult.message,
              raw: visitResult.raw,
            });
            failCount++;
            break;
          }

          results.push({
            name: '寻访',
            success: true,
            message: visitResult.message,
            raw: visitResult.raw,
          });
          visitCount++;

          await this.delay(2000);
        }

        // 挑战仙人
        const fightHtml = await this.request('immortals', { op: 'fightimmortals' });
        const fightResult = this.extractFightResult(fightHtml);
        
        results.push({
          name: '挑战',
          success: fightResult.success,
          message: fightResult.message,
          raw: fightResult.raw,
        });
        
        if (fightResult.success) {
          successCount++;
        } else {
          failCount++;
        }

        challengesUsed++;
        remainingChallenges--;
        hasPendingImmortal = false;

        if (remainingChallenges > 0) {
          await this.delay(2000);
        }
      } catch (error) {
        results.push({
          name: '挑战',
          success: false,
          message: error.message,
          raw: '',
        });
        failCount++;
        break;
      }
    }

    const summary = `仙武修真：挑战${challengesUsed}次，成功${successCount}项，失败${failCount}项`;
    const details = results.map(r => {
      let msg = `${r.name}: ${r.message}`;
      if (r.raw) msg += `\n响应：${r.raw}`;
      return msg;
    }).join('\n');
    
    this.log(`${summary}\n${details}`, failCount === 0 ? 'success' : 'error');

    return this.success({
      result: summary,
      challengesUsed,
      remainingChallenges,
      results,
      successCount,
      failCount,
    });
  }
}

module.exports = {
  ImmortalsAction,
  action: new ImmortalsAction(),
};
