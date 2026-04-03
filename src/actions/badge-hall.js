const { ActionBase } = require('../core/action-base');
const { badgeTypes, badgeConfigs } = require('../db');

class BadgeHallAction extends ActionBase {
  constructor() {
    super({
      id: 'badgehall',
      name: '徽章馆',
      description: '执行时自动进阶勾选的徽章（先扫描所有徽章，再对勾选的徽章执行进阶1次）',
      category: '每日任务',
    });
  }

  parseBadgeList(html) {
    if (!html) return { badges: [], achievement: 0, badgeCount: 0, totalPages: 1, currentPage: 1 };
    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      throw new Error('登录已过期，请重新扫码登录');
    }
    const badges = [];
    let achievement = 0, badgeCount = 0, totalPages = 1, currentPage = 1;
    const achievementMatch = html.match(/我的成就[：:]\s*(\d+)/);
    if (achievementMatch) achievement = parseInt(achievementMatch[1]);
    const badgeCountMatch = html.match(/我的徽章[：:]\s*(\d+)/);
    if (badgeCountMatch) badgeCount = parseInt(badgeCountMatch[1]);
    const badgeLinkRegex = /(青铜|白银|黄金|铂金|白金|钻石|王者)\s*(\d+)阶\s*<a[^>]*achievement_id=(\d+)[^>]*>([^<]+)<\/a>/gi;
    let match;
    while ((match = badgeLinkRegex.exec(html)) !== null) {
      badges.push({ rank: match[1], stage: parseInt(match[2]), id: match[3], name: match[4].trim() });
    }
    if (badges.length === 0) {
      const badgeSimpleRegex = /(青铜|白银|黄金|铂金|白金|钻石|王者)\s*(\d+)阶\s*([^\s<]+)/gi;
      while ((match = badgeSimpleRegex.exec(html)) !== null) {
        badges.push({ rank: match[1], stage: parseInt(match[2]), id: '', name: match[3].trim() });
      }
    }
    const pageMatch = html.match(/pages=(\d+)/gi);
    if (pageMatch) {
      const prevPageMatch = html.match(/pages=(\d+)[^"]*"[^>]*>上一页/);
      const nextPageMatch = html.match(/pages=(\d+)[^"]*"[^>]*>下一页/);
      if (prevPageMatch) currentPage = parseInt(prevPageMatch[1]);
      if (nextPageMatch) totalPages = Math.max(currentPage, parseInt(nextPageMatch[1]));
    }
    return { badges, achievement, badgeCount, totalPages, currentPage };
  }

  async run(params = {}) {
    const { action = 'auto', page = 1, achievementId = null } = params;
    try {
      const html = await this.request('index', {});
      if (!html || html.includes('ptlogin2.qq.com')) {
        this.log('登录已过期，请重新扫码登录', 'error');
        return this.fail('登录已过期，请重新扫码登录');
      }
      if (action === 'auto') return await this.runAutoUpgrade();
      if (action === 'list') {
        const listHtml = await this.request('achievement', { pages: page });
        const listResult = this.parseBadgeList(listHtml);
        const summary = `徽章馆：成就 ${listResult.achievement}，徽章 ${listResult.badgeCount} 个`;
        this.log(summary, 'success');
        return this.success({ result: summary, ...listResult });
      }
      if (action === 'doupgrade' && achievementId) {
        const { times = 1 } = params;
        const upgradeHtml = await this.request('achievement', { op: 'upgradelevel', achievement_id: achievementId, times });
        if (upgradeHtml.includes('成功')) {
          this.log(`徽章 ${achievementId} 进阶成功`, 'success');
          return this.success({ result: '进阶成功', achievementId });
        }
        this.log(`徽章 ${achievementId} 进阶请求已发送`, 'success');
        return this.success({ result: '请求已发送', achievementId, html: upgradeHtml });
      }
      return this.fail('未知操作: ' + action);
    } catch (error) {
      this.log('操作失败: ' + error.message, 'error');
      return this.fail(error.message);
    }
  }

  async runAutoUpgrade() {
    const results = [];
    let allBadges = [], page = 1, totalPages = 1, achievement = 0;
    this.log('正在扫描徽章列表...', 'success');
    do {
      const listResult = this.parseBadgeList(await this.request('achievement', { pages: page }));
      if (listResult.badges.length > 0) allBadges = allBadges.concat(listResult.badges);
      if (page === 1 && listResult.achievement > 0) achievement = listResult.achievement;
      totalPages = listResult.totalPages || 1;
      page++;
    } while (page <= totalPages && page <= 20);
    const uniqueBadges = [...new Map(allBadges.map(b => [b.id, b])).values()];
    if (uniqueBadges.length > 0) badgeTypes.upsertBatch(uniqueBadges.map(b => ({ id: b.id, name: b.name, rank: b.rank, stage: b.stage })));
    this.log(`扫描完成：共 ${uniqueBadges.length} 个徽章`, 'success');
    const enabledConfigs = badgeConfigs.getEnabled();
    if (enabledConfigs.length === 0) {
      return this.success({ result: '没有勾选需要进阶的徽章', totalBadges: uniqueBadges.length, achievement, upgradeCount: 0, results: [] });
    }
    this.log(`开始进阶 ${enabledConfigs.length} 个勾选的徽章...`, 'success');
    for (const config of enabledConfigs) {
      try {
        const upgradeHtml = await this.request('achievement', { op: 'upgradelevel', achievement_id: config.badge_id, times: 1 });
        let status = upgradeHtml.includes('成功') ? '成功' : '已发送';
        results.push({ id: config.badge_id, name: config.name, status });
        this.log(`${config.name} ${status}`, 'success');
        await this.delay(1500);
      } catch (e) {
        results.push({ id: config.badge_id, name: config.name, status: '错误', message: e.message });
      }
    }
    const successCount = results.filter(r => r.status === '成功' || r.status === '已发送').length;
    const summary = `徽章馆执行完成：扫描 ${uniqueBadges.length} 个，进阶 ${enabledConfigs.length} 个，成功 ${successCount} 个`;
    this.log(summary, 'success');
    return this.success({ result: summary, totalBadges: uniqueBadges.length, achievement, upgradeCount: enabledConfigs.length, successCount, results });
  }
}

module.exports = { BadgeHallAction, action: new BadgeHallAction() };