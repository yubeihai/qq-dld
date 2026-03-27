const { ActionBase } = require('../core/action-base');

class WulinAction extends ActionBase {
  constructor() {
    super({
      id: 'wulin',
      name: '武林大会',
      description: '自动随机报名武林大会',
      category: '每日任务',
    });
  }

  extractResult(html) {
    if (!html) return { success: false, message: '无响应', raw: '' };
    
    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期，请重新扫码登录', raw: '' };
    }
    
    if (html.includes('已成功报名武林大会')) {
      const match = html.match(/已成功报名武林大会[：:]\s*([^<\n]+)/);
      return { success: true, message: match ? `报名成功：${match[1]}` : '报名成功', raw: '' };
    }
    
    if (html.includes('已报名') || html.includes('已参加')) {
      const match = html.match(/报名状态[：:]\s*已报名参加([^<\n]+)/);
      return { success: true, message: match ? `已报名：${match[1]}` : '已报名', raw: '' };
    }
    
    if (html.includes('不能参加') || html.includes('无法报名') || html.includes('等级不够')) {
      const match = html.match(/不能参加[^<\n]*|无法报名[^<\n]*|等级不够[^<\n]*/);
      return { success: false, message: match ? match[0] : '无法报名', raw: '' };
    }
    
    if (html.includes('系统繁忙')) {
      return { success: false, message: '系统繁忙，请稍后重试', raw: '' };
    }
    
    const text = this.extractText(html).substring(0, 200);
    return { success: false, message: '未知结果', raw: text };
  }

  async run(params = {}) {
    let html;
    try {
      html = await this.request('showwulin', {});
      if (!html || html.includes('ptlogin2.qq.com')) {
        return this.fail('登录已过期，请重新扫码登录');
      }
    } catch (error) {
      return this.fail(error.message);
    }

    const result = this.extractResult(html);
    if (result.success) {
      this.log(`武林大会：${result.message}`, 'success');
      return this.success({ result: result.message });
    }

    try {
      const signupHtml = await this.request('fastSignWulin', { ifFirstSign: 1 });
      const signupResult = this.extractResult(signupHtml);
      
      this.log(`武林大会报名：${signupResult.message}`, signupResult.success ? 'success' : 'error');

      return signupResult.success 
        ? this.success({ result: signupResult.message })
        : this.fail(signupResult.message);
    } catch (error) {
      return this.fail(error.message);
    }
  }
}

module.exports = {
  WulinAction,
  action: new WulinAction(),
};
