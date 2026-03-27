const { ActionBase } = require('../core/action-base');

class CallbackRecallAction extends ActionBase {
  constructor() {
    super({
      id: 'callbackrecall',
      name: '豆油召回',
      description: '随机召回3位好友，邀请回来玩吧',
      category: '好友',
    });
  }

  parseRecallLinks(html) {
    if (!html) return [];
    
    const links = [];
    const decodedHtml = html.replace(/&amp;/g, '&');
    const regex = /cmd=callback&subtype=1&opuin=(\d+)/g;
    let match;
    
    while ((match = regex.exec(decodedHtml)) !== null) {
      const opuin = match[1];
      if (opuin && !links.find(l => l.opuin === opuin)) {
        links.push({ opuin });
      }
    }
    
    return links;
  }

  parseDailyCount(html) {
    const match = html.match(/今日发送：(\d+)\/(\d+)/);
    if (match) {
      return { sent: parseInt(match[1]), total: parseInt(match[2]) };
    }
    return { sent: 0, total: 3 };
  }

  shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async run(params = {}) {
    const { count = 3 } = params;
    
    try {
      const html = await this.request('callback', { subtype: '3', page: '1' });
      
      const dailyCount = this.parseDailyCount(html);
      const remaining = dailyCount.total - dailyCount.sent;
      
      if (remaining <= 0) {
        const msg = `今日已完成召回(${dailyCount.sent}/${dailyCount.total})`;
        this.log(msg, 'success');
        return this.success({ result: msg, sent: dailyCount.sent, total: dailyCount.total });
      }
      
      const links = this.parseRecallLinks(html);
      
      if (links.length === 0) {
        const msg = '没有可召回的好友';
        this.log(msg, 'error');
        return this.fail(msg);
      }
      
      const toSend = Math.min(remaining, count, links.length);
      const selected = this.shuffle(links).slice(0, toSend);
      
      const results = [];
      let successCount = 0;
      
      for (const link of selected) {
        try {
          const resultHtml = await this.request('callback', { subtype: '1', opuin: link.opuin });
          
          if (resultHtml.includes('成功') || resultHtml.includes('已发送') || resultHtml.includes('召回')) {
            results.push({ opuin: link.opuin, success: true, result: '发送成功' });
            successCount++;
          } else if (resultHtml.includes('已召回') || resultHtml.includes('已经')) {
            results.push({ opuin: link.opuin, success: true, result: '已召回过' });
            successCount++;
          } else {
            results.push({ opuin: link.opuin, success: false, result: '未知结果' });
          }
          
          await this.delay(500);
        } catch (error) {
          results.push({ opuin: link.opuin, success: false, result: error.message });
        }
      }
      
      const summary = `豆油召回：${successCount}/${toSend}成功`;
      const details = results.map(r => `opuin=${r.opuin}: ${r.result}`).join('\n');
      
      this.log(`${summary}\n${details}`, successCount === toSend ? 'success' : 'error');
      
      return this.success({
        result: summary,
        details: results,
        successCount,
        totalSent: dailyCount.sent + successCount,
        dailyLimit: dailyCount.total,
      });
    } catch (error) {
      this.log(`豆油召回失败: ${error.message}`, 'error');
      return this.fail(error.message);
    }
  }
}

module.exports = {
  CallbackRecallAction,
  action: new CallbackRecallAction(),
};