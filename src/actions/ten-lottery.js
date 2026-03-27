const { ActionBase } = require('../core/action-base');

class TenLotteryAction extends ActionBase {
  constructor() {
    super({
      id: 'tenlottery',
      name: '邪神秘宝',
      description: '每日免费抽奖（高级秘宝24h、极品秘宝96h）',
      category: '每日任务',
    });
  }

  extractResult(html) {
    if (!html) return { success: false, message: '无响应', raw: '' };

    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期，请重新扫码登录', raw: '' };
    }

    if (html.includes('获得') || html.includes('恭喜') || html.includes('中奖')) {
      const match = html.match(/获得[^<\n]*/);
      return { success: true, message: match ? match[0] : '抽奖成功', raw: '' };
    }

    if (html.includes('系统繁忙')) {
      return { success: false, message: '系统繁忙，请稍后重试', raw: '' };
    }

    const text = this.extractText(html).substring(0, 200);
    return { success: true, message: '抽奖完成', raw: text };
  }

  parsePage(html) {
    const result = {
      highLevel: { canFree: false, link: null },
      premium: { canFree: false, link: null },
    };

    const sections = html.split(/=高级秘宝=|=极品秘宝=/);
    
    if (sections.length > 1) {
      const highLevelSection = sections[1] || '';
      if (highLevelSection.includes('0时0分0秒后免费')) {
        result.highLevel.canFree = true;
      }
    }

    if (sections.length > 2) {
      const premiumSection = sections[2] || '';
      if (premiumSection.includes('0时0分0秒后免费')) {
        result.premium.canFree = true;
      }
    }

    const highLevelMatch = html.match(/href="([^"]*cmd=tenlottery[^"]*op=2[^"]*type=0[^"]*)"/);
    if (highLevelMatch) {
      result.highLevel.link = highLevelMatch[1].replace(/&amp;/g, '&');
    }

    const premiumMatch = html.match(/href="([^"]*cmd=tenlottery[^"]*op=2[^"]*type=1[^"]*)"/);
    if (premiumMatch) {
      result.premium.link = premiumMatch[1].replace(/&amp;/g, '&');
    }

    return result;
  }

  buildUrl(link) {
    if (!link) return null;
    if (link.startsWith('//')) return 'https:' + link;
    if (link.startsWith('/')) return 'https://dld.qzapp.z.qq.com' + link;
    return link;
  }

  async run(params = {}) {
    const results = [];

    try {
      const html = await this.request('tenlottery', { op: '0' });
      
      if (html.includes('ptlogin2.qq.com')) {
        return this.fail('登录已过期，请重新扫码登录');
      }

      const pageData = this.parsePage(html);

      if (pageData.highLevel.canFree && pageData.highLevel.link) {
        await this.delay(1000);
        const url = this.buildUrl(pageData.highLevel.link);
        const resultHtml = await this.fetchUrl(url);
        const result = this.extractResult(resultHtml);
        results.push(`高级秘宝: ${result.message}`);
      } else {
        results.push('高级秘宝: 未到免费时间');
      }

      if (pageData.premium.canFree && pageData.premium.link) {
        await this.delay(1000);
        const url = this.buildUrl(pageData.premium.link);
        const resultHtml = await this.fetchUrl(url);
        const result = this.extractResult(resultHtml);
        results.push(`极品秘宝: ${result.message}`);
      } else {
        results.push('极品秘宝: 未到免费时间');
      }

      const summary = results.join('\n');
      this.log(summary, 'success');
      
      return this.success({ result: summary });

    } catch (error) {
      this.log(error.message, 'error');
      return this.fail(error.message);
    }
  }
}

module.exports = {
  TenLotteryAction,
  action: new TenLotteryAction(),
};