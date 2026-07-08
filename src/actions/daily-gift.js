const { ActionBase } = require('../core/action-base');
const { SessionLogger } = require('../core/session-logger');
const { ErrorHandler } = require('../core/error-handler');

class DailyGiftAction extends ActionBase {
  constructor() {
    super({
      id: 'dailygift',
      name: '每日奖励',
      description: '领取每日礼包、传功符礼包、达人礼包、无字天书礼包',
      category: '每日任务',
    });

    this.gifts = [
      { cmd: 'dailygift', params: { op: 'draw', key: 'login' }, name: '每日礼包' },
      { cmd: 'dailygift', params: { op: 'draw', key: 'meridian' }, name: '传功符礼包' },
      { cmd: 'dailygift', params: { op: 'draw', key: 'daren' }, name: '达人礼包' },
      { cmd: 'dailygift', params: { op: 'draw', key: 'wuzitianshu' }, name: '无字天书礼包' },
    ];
  }

  extractResult(html, giftName) {
    if (!html) return { success: false, message: '无响应', detail: {} };

    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期', detail: {} };
    }

    if (html.includes('已领取') || html.includes('已经领取') || html.includes('领过了')) {
      return { success: true, message: '今日已领取', detail: {} };
    }

    if (html.includes('领取成功') || html.includes('恭喜') || html.includes('获得')) {
      const match = html.match(/获得[^<\n]*/);
      return { success: true, message: match ? match[0] : '领取成功', detail: {} };
    }

    if (html.includes('系统繁忙')) {
      return { success: false, message: '系统繁忙', detail: {} };
    }

    return { success: false, message: '未知结果', detail: {} };
  }

  async run(params = {}) {
    const logger = this.createLogger(params.source || 'manual');
    logger.start(params);

    const results = [];
    let successCount = 0;
    let failCount = 0;
    const stepStart = Date.now();

    try {
      const loginStart = Date.now();
      const html = await this.request('index', {});
      const loginElapsed = Date.now() - loginStart;

      if (!html || html.includes('ptlogin2.qq.com')) {
        logger.step('check', '登录状态', 'failed', {}, '登录已过期', loginElapsed);
        return this.handleError(ErrorHandler.loginExpired());
      }

      logger.step('check', '登录状态', 'success', {}, '', loginElapsed);
    } catch (error) {
      logger.step('check', '登录状态', 'failed', {}, error.message, Date.now() - stepStart);
      return this.handleError(error);
    }

    for (const gift of this.gifts) {
      const giftStart = Date.now();
      try {
        const giftHtml = await this.request(gift.cmd, gift.params);
        const elapsed = Date.now() - giftStart;
        const result = this.extractResult(giftHtml, gift.name);

        results.push({
          name: gift.name,
          success: result.success,
          message: result.message,
        });

        if (result.success) {
          successCount++;
          logger.step('claim', gift.name, 'success', { message: result.message }, '', elapsed);
        } else {
          failCount++;
          logger.step('claim', gift.name, 'failed', { message: result.message }, '', elapsed);
        }
      } catch (error) {
        const elapsed = Date.now() - giftStart;
        results.push({
          name: gift.name,
          success: false,
          message: error.message,
        });
        failCount++;
        logger.step('claim', gift.name, 'failed', {}, error.message, elapsed);
      }
    }

    const summary = `领取礼包：成功${successCount}个，失败${failCount}个`;
    const finalStatus = failCount === 0 ? 'success' : 'partial';

    logger.end(finalStatus, {
      successCount,
      failCount,
      total: this.gifts.length,
      gifts: results,
    });

    return this.success({
      result: summary,
      gifts: results,
      successCount,
      failCount,
      sessionId: logger.sessionId,
    });
  }
}

module.exports = {
  DailyGiftAction,
  action: new DailyGiftAction(),
};
