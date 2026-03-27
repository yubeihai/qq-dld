const { ActionBase } = require('../core/action-base');

class DailyGiftAction extends ActionBase {
  constructor() {
    super({
      id: 'dailygift',
      name: '每日奖励',
      description: '领取每日礼包、传功符礼包、达人礼包、无字天书礼包',
      category: '每日任务',
    });
  }

  extractResult(html, giftName) {
    if (!html) return { success: false, message: '无响应', raw: '' };
    
    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期，请重新扫码登录', raw: '' };
    }
    
    if (html.includes('已领取') || html.includes('已经领取') || html.includes('领过了')) {
      return { success: true, message: '今日已领取', raw: '' };
    }
    
    if (html.includes('领取成功') || html.includes('恭喜') || html.includes('获得')) {
      const match = html.match(/获得[^<\n]*/);
      return { success: true, message: match ? match[0] : '领取成功', raw: '' };
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
      html = await this.request('index', {});
      if (!html || html.includes('ptlogin2.qq.com')) {
        return this.fail('登录已过期，请重新扫码登录');
      }
    } catch (error) {
      return this.fail(error.message);
    }

    const gifts = [
      { cmd: 'dailygift', params: { op: 'draw', key: 'login' }, name: '每日礼包' },
      { cmd: 'dailygift', params: { op: 'draw', key: 'meridian' }, name: '传功符礼包' },
      { cmd: 'dailygift', params: { op: 'draw', key: 'daren' }, name: '达人礼包' },
      { cmd: 'dailygift', params: { op: 'draw', key: 'wuzitianshu' }, name: '无字天书礼包' },
    ];

    for (const gift of gifts) {
      try {
        const html = await this.request(gift.cmd, gift.params);
        const result = this.extractResult(html, gift.name);
        
        results.push({
          name: gift.name,
          success: result.success,
          message: result.message,
          raw: result.raw,
        });
        
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        results.push({
          name: gift.name,
          success: false,
          message: error.message,
          raw: '',
        });
        failCount++;
      }
    }

    const summary = `领取礼包：成功${successCount}个，失败${failCount}个`;
    const details = results.map(r => {
      let msg = `${r.name}: ${r.message}`;
      if (r.raw) msg += `\n响应: ${r.raw}`;
      return msg;
    }).join('\n');
    
    this.log(`${summary}\n${details}`, failCount === 0 ? 'success' : 'error');

    return this.success({
      result: summary,
      gifts: results,
      successCount,
      failCount,
    });
  }
}

module.exports = {
  DailyGiftAction,
  action: new DailyGiftAction(),
};