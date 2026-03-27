const { ActionBase } = require('../core/action-base');

class KnightFightAction extends ActionBase {
  constructor() {
    super({
      id: 'knightfight',
      name: '笑傲群侠',
      description: '自动随机报名笑傲群侠',
      category: '每日任务',
    });
  }

  extractResult(html) {
    if (!html) return { success: false, message: '无响应', raw: '' };

    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期，请重新扫码登录', raw: '' };
    }

    if (html.includes('报名成功') || html.includes('参赛')) {
      const match = html.match(/报名成功[^<\n]*/);
      return { success: true, message: match ? match[0] : '报名成功', raw: '' };
    }

    if (html.includes('已参赛') || html.includes('已报名')) {
      return { success: true, message: '已报名参赛', raw: '' };
    }

    if (html.includes('玄铁令不足') || html.includes('没有玄铁令')) {
      return { success: false, message: '玄铁令不足', raw: '' };
    }

    if (html.includes('系统繁忙')) {
      return { success: false, message: '系统繁忙，请稍后重试', raw: '' };
    }

    const text = this.extractText(html).substring(0, 200);
    return { success: false, message: '未知结果', raw: text };
  }

  findRandomSignupLink(html) {
    const match = html.match(/href="([^"]*cmd=knightfight[^"]*op=view_index[^"]*kind=1[^"]*)"/);
    if (match) {
      let url = match[1].replace(/&amp;/g, '&');
      if (url.startsWith('//')) url = 'https:' + url;
      if (url.startsWith('/')) url = 'https://dld.qzapp.z.qq.com' + url;
      return url;
    }
    return null;
  }

  findConfirmLink(html) {
    const match = html.match(/href="([^"]*cmd=knightfight[^"]*op=signup[^"]*)"/);
    if (match) {
      let url = match[1].replace(/&amp;/g, '&');
      if (url.startsWith('//')) url = 'https:' + url;
      if (url.startsWith('/')) url = 'https://dld.qzapp.z.qq.com' + url;
      return url;
    }
    return null;
  }

  buildUrl(link) {
    if (!link) return null;
    if (link.startsWith('//')) return 'https:' + link;
    if (link.startsWith('/')) return 'https://dld.qzapp.z.qq.com' + link;
    return link;
  }

  async run(params = {}) {
    try {
      const html = await this.request('knightfight', { op: 'view_index' });

      if (html.includes('ptlogin2.qq.com')) {
        return this.fail('登录已过期，请重新扫码登录');
      }

      if (html.includes('已参赛') || html.includes('报名状态：已参赛')) {
        this.log('已报名参赛', 'success');
        return this.success({ result: '已报名参赛' });
      }

      const signupLink = this.findRandomSignupLink(html);
      if (!signupLink) {
        this.log('未找到随机报名链接', 'error');
        return this.fail('未找到随机报名链接，可能已报名');
      }

      await this.delay(1000);
      const confirmHtml = await this.fetchUrl(this.buildUrl(signupLink));

      if (confirmHtml.includes('已参赛')) {
        this.log('已报名参赛', 'success');
        return this.success({ result: '已报名参赛' });
      }

      const confirmLink = this.findConfirmLink(confirmHtml);
      if (!confirmLink) {
        this.log('未找到确认按钮', 'error');
        return this.fail('未找到确认按钮');
      }

      await this.delay(1000);
      const resultHtml = await this.fetchUrl(this.buildUrl(confirmLink));
      const result = this.extractResult(resultHtml);

      this.log(result.message, result.success ? 'success' : 'error');
      return result.success
        ? this.success({ result: result.message })
        : this.fail(result.message);

    } catch (error) {
      this.log(error.message, 'error');
      return this.fail(error.message);
    }
  }
}

module.exports = {
  KnightFightAction,
  action: new KnightFightAction(),
};