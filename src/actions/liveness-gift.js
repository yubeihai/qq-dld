const { ActionBase } = require('../core/action-base');

class LivenessGiftAction extends ActionBase {
  constructor() {
    super({
      id: 'livenessgift',
      name: '活跃礼包',
      description: '领取活跃度礼包和帮派活跃奖励',
      category: '每日任务',
    });
  }

  async run(params = {}) {
    let html;
    try {
      html = await this.request('phonepk', { cmd: 'liveness' });
      if (!html || html.includes('ptlogin2.qq.com')) {
        return this.fail('登录已过期，请重新扫码登录');
      }
    } catch (error) {
      return this.fail(error.message);
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;

    const todayLivenessMatch = html.match(/【今日活跃度：(\d+) 分】/);
    const todayLiveness = todayLivenessMatch ? todayLivenessMatch[1] : '未知';

    const factionLivenessMatch = html.match(/帮派总活跃：(\d+)\/(\d+)/);
    const factionCurrent = factionLivenessMatch ? factionLivenessMatch[1] : '未知';
    const factionTarget = factionLivenessMatch ? factionLivenessMatch[2] : '未知';

    results.push({
      name: '活跃度信息',
      success: true,
      message: `今日活跃度：${todayLiveness}分，帮派活跃：${factionCurrent}/${factionTarget}`,
    });
    successCount++;

    // 领取帮派总活跃奖励
    try {
      await this.delay(500);
      const factionHtml = await this.request('factionop', { subtype: '18' });

      if (factionHtml.includes('领取成功') || factionHtml.includes('恭喜') || factionHtml.includes('获得')) {
        const match = factionHtml.match(/获得[^<\n]*/);
        results.push({
          name: '帮派总活跃奖励',
          success: true,
          message: match ? match[0] : '领取成功',
        });
        successCount++;
      } else if (factionHtml.includes('已领取') || factionHtml.includes('已经领取')) {
        results.push({
          name: '帮派总活跃奖励',
          success: true,
          message: '今日已领取',
        });
        successCount++;
      } else {
        results.push({
          name: '帮派总活跃奖励',
          success: false,
          message: '领取失败',
        });
        failCount++;
      }
    } catch (error) {
      results.push({
        name: '帮派总活跃奖励',
        success: false,
        message: error.message,
      });
      failCount++;
    }

    const gifts = [
      { giftbagid: '1', name: '活跃小礼包', need: 20 },
      { giftbagid: '2', name: '活跃中礼包', need: 50 },
      { giftbagid: '3', name: '活跃大礼包', need: 80 },
      { giftbagid: '4', name: '活跃终极礼包', need: 115 },
    ];

    for (const gift of gifts) {
      try {
        await this.delay(500);
        const giftHtml = await this.request('phonepk', {
          cmd: 'liveness_getgiftbag',
          giftbagid: gift.giftbagid,
          action: '1',
        });

        if (giftHtml.includes('领取成功') || giftHtml.includes('恭喜') || giftHtml.includes('获得')) {
          const match = giftHtml.match(/获得[^<\n]*/);
          results.push({
            name: gift.name,
            success: true,
            message: match ? match[0] : '领取成功',
          });
          successCount++;
        } else if (giftHtml.includes('已领取') || giftHtml.includes('已经领取') || giftHtml.includes('领过了')) {
          results.push({
            name: gift.name,
            success: true,
            message: '今日已领取',
          });
          successCount++;
        } else if (giftHtml.includes('活跃度') || giftHtml.includes('不够') || giftHtml.includes('条件')) {
          results.push({
            name: gift.name,
            success: false,
            message: `活跃度不足 (需要${gift.need}点)`,
          });
          failCount++;
        } else {
          results.push({
            name: gift.name,
            success: false,
            message: '领取失败或条件不满足',
          });
          failCount++;
        }
      } catch (error) {
        results.push({
          name: gift.name,
          success: false,
          message: error.message,
        });
        failCount++;
      }
    }

    const summary = `活跃礼包：成功${successCount}项，失败${failCount}项`;
    const details = results.map(r => `${r.name}: ${r.message}`).join('\n');

    this.log(`${summary}\n${details}`, failCount === 0 ? 'success' : 'error');

    return this.success({
      result: summary,
      todayLiveness,
      details: results,
      successCount,
      failCount,
    });
  }
}

module.exports = {
  LivenessGiftAction,
  action: new LivenessGiftAction(),
};
