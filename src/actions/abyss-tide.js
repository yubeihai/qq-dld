const { ActionBase } = require('../core/action-base');

class AbyssTideAction extends ActionBase {
  constructor() {
    super({
      id: 'abysstide',
      name: '深渊之潮',
      description: '深渊秘境、深渊黑商、帮派巡礼、许愿帮铺、灵枢精魄等',
      category: '每日任务',
    });
  }

  extractResult(html, operation) {
    if (!html) return { success: false, message: '无响应', raw: '' };
    
    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期，请重新扫码登录', raw: '' };
    }
    
    if (html.includes('领取成功') || html.includes('获得') || html.includes('恭喜')) {
      const match = html.match(/获得[^<\n]*/);
      return { success: true, message: match ? match[0] : '操作成功', raw: '' };
    }
    
    if (html.includes('系统繁忙')) {
      return { success: false, message: '系统繁忙，请稍后重试', raw: '' };
    }
    
    const text = this.extractText(html).substring(0, 200);
    return { success: true, message: '查看成功', raw: text };
  }

  async run(params = {}) {
    const results = [];
    let successCount = 0;
    let failCount = 0;

    try {
      const html = await this.request('abysstide', {});
      if (!html || html.includes('ptlogin2.qq.com')) {
        return this.fail('登录已过期，请重新扫码登录');
      }
    } catch (error) {
      return this.fail(error.message);
    }

    const operations = [
      { op: 'viewallabyss', name: '深渊秘境' },
      { op: 'viewabyssshop', name: '深渊黑商' },
      { op: 'viewfactiongift', name: '帮派巡礼' },
      { op: 'viewwishshop', name: '许愿帮铺' },
      { op: 'showsoul', name: '灵枢精魄' },
      { op: 'showrank', name: '魂魄战力榜' },
      { op: 'showfeeds', name: '深渊战斗记录' },
    ];

    for (const operation of operations) {
      try {
        const html = await this.request('abysstide', { op: operation.op });
        const result = this.extractResult(html, operation.name);
        
        results.push({
          name: operation.name,
          success: result.success,
          message: result.message,
          raw: result.raw,
        });
        
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }

        await this.delay(500);
      } catch (error) {
        results.push({
          name: operation.name,
          success: false,
          message: error.message,
          raw: '',
        });
        failCount++;
      }
    }

    const summary = `深渊之潮：成功${successCount}项，失败${failCount}项`;
    const details = results.map(r => `${r.name}: ${r.message}`).join('\n');
    
    this.log(`${summary}\n${details}`, failCount === 0 ? 'success' : 'error');

    return this.success({
      result: summary,
      operations: results,
      successCount,
      failCount,
    });
  }
}

module.exports = {
  AbyssTideAction,
  action: new AbyssTideAction(),
};
