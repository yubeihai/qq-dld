const { ActionBase } = require('../core/action-base');

/**
 * 武林盟主模块
 *
 * 【赛事构成】
 * - 一个完整赛季由 5 个分站赛 + 1 个总决赛组成
 * - 分站赛：华山、峨眉、武当、明教、少林
 * - 每个分站赛 3 轮比赛，每轮持续 2 天
 *
 * 【报名时间】
 * - 分站赛各轮次：周一 12 点至 23 点 55 分、周三 12 点至 23 点 55 分、周五 12 点至 23 点 55 分
 * - 总决赛无需手动报名（分站总排名前 512 名自动进入）
 *
 * 【报名规则】
 * - 40 级以上玩家才能参加
 * - 黄金赛场：战力 ≥ 2000
 * - 白银赛场：战力 ≥ 1000
 * - 青铜赛场：战力 ≥ 200
 *
 * 【比赛规则】
 * - 1 回合决定胜负的 2 进 1 淘汰赛
 * - 8 强产生后开启竞猜时间
 * - 按排名积分汇总决定最终排名
 */
class WulinMengzhuAction extends ActionBase {
  constructor() {
    super({
      id: 'wulinmengzhu',
      name: '武林盟主',
      description: '武林盟主报名（支持黄金/白银/青铜赛场）',
      category: '挑战',
    });
  }

  /**
   * 提取武林盟主页面信息
   */
  extractIndexInfo(html) {
    if (!html) return { success: false, message: '无响应' };

    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期，请重新扫码登录' };
    }

    const info = {};
    console.log('[武林盟主] HTML 内容预览:', html.substring(0, 500));

    // 提取赛季信息 - 支持多种格式
    const seasonMatch = html.match(/【武林盟主 - 第？(\d+) 届？(?:- ([^】]+))？】/);
    if (seasonMatch) {
      info.season = `第${seasonMatch[1]}届`;
      info.faction = seasonMatch[2] || '';
      console.log('[武林盟主] 匹配到赛季:', info.season, info.faction);
    }

    // 提取轮次信息
    const roundMatch = html.match(/第？(\d+) 轮/);
    if (roundMatch) {
      info.round = `第${roundMatch[1]}轮`;
      console.log('[武林盟主] 匹配到轮次:', info.round);
    }

    // 提取报名倒计时 - 支持多种格式
    const timeMatch = html.match(/距离报名结束\s*(\d+)\s*小时\s*(\d+)\s*分钟/);
    if (timeMatch) {
      info.countdown = `${timeMatch[1]}小时${timeMatch[2]}分钟`;
      console.log('[武林盟主] 匹配到倒计时:', info.countdown);
    }

    // 提取赛场信息 - 处理 &amp; 编码
    info.grounds = [];
    const groundMatches = html.matchAll(/【(黄金 | 白银 | 青铜) 赛场】[^\n]*?ground_id=(\d+)/g);
    for (const match of groundMatches) {
      info.grounds.push({
        name: match[1],
        groundId: match[2],
      });
      console.log('[武林盟主] 匹配到赛场:', match[1], match[2]);
    }

    // 如果没有匹配到具体信息，尝试提取页面文本内容
    if (!info.season && !info.countdown) {
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      console.log('[武林盟主] 提取纯文本:', text.substring(0, 300));
      
      // 尝试从纯文本中提取
      const textSeason = text.match(/武林盟主.*?(\d+).*?届/);
      if (textSeason) {
        info.season = `第${textSeason[1]}届`;
      }
    }

    return {
      success: true,
      message: `当前赛事：${info.season || '未知'} ${info.faction || ''} ${info.round || ''}, 距离报名结束：${info.countdown || '未知'}`,
      data: info,
    };
  }

  /**
   * 提取报名结果
   */
  extractSignupResult(html) {
    if (!html) return { success: false, message: '无响应' };

    console.log('[武林盟主] 报名返回 HTML 预览:', html.substring(0, 800));

    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期，请重新扫码登录' };
    }

    // 报名成功
    if (html.includes('报名成功') || html.includes('已成功报名')) {
      return { success: true, message: '报名成功' };
    }

    // 已报名
    if (html.includes('已报名') || html.includes('已参加')) {
      return { success: true, message: '已报名' };
    }

    // 报名失败原因
    if (html.includes('等级不够') || html.includes('等级不足')) {
      return { success: false, message: '等级不够（需要 40 级以上）' };
    }

    if (html.includes('战力不够') || html.includes('战力不足')) {
      const match = html.match(/战力 [^<\n]*|不符合 [^<\n]*/);
      return { success: false, message: match ? match[0] : '战力不足' };
    }

    if (html.includes('不能参加') || html.includes('无法报名')) {
      const match = html.match(/不能参加 [^<\n]*|无法报名 [^<\n]*/);
      return { success: false, message: match ? match[0] : '无法报名' };
    }

    if (html.includes('系统繁忙')) {
      return { success: false, message: '系统繁忙，请稍后重试' };
    }

    if (html.includes('报名时间已结束')) {
      return { success: false, message: '报名时间已结束' };
    }
    
    // 尝试从 HTML 中提取错误信息
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log('[武林盟主] 报名返回纯文本:', text.substring(0, 300));
    
    // 检查是否有明显的内容表示页面正常
    if (html.includes('武林盟主') && html.includes('赛场')) {
      // 可能已经报名了，返回页面但没有明确提示
      return { success: true, message: '报名页面正常，可能已报名或未开放' };
    }

    return { success: false, message: '未知结果' };
  }

  async run(params = {}) {
    const { signup = false, groundId } = params;

    console.log('[武林盟主] 开始执行，signup:', signup, 'groundId:', groundId);

    // 获取武林盟主首页信息
    let html;
    try {
      html = await this.request('wlmz', { op: 'view_index' });
      console.log('[武林盟主] 获取首页 HTML 长度:', html?.length);
      
      if (!html || html.includes('ptlogin2.qq.com')) {
        return this.fail('登录已过期，请重新扫码登录');
      }
    } catch (error) {
      console.error('[武林盟主] 获取首页失败:', error.message);
      return this.fail(error.message);
    }

    // 如果只需要查看信息（非报名模式）
    if (!signup) {
      const result = this.extractIndexInfo(html);
      console.log('[武林盟主] 提取信息结果:', result);
      
      if (result.success) {
        this.log(`武林盟主：${result.message}`, 'success');
        return this.success(result);
      }
      return this.fail(result.message);
    }

    // 执行报名逻辑
    if (!groundId) {
      // 默认报名黄金赛场 (ground_id=1)
      groundId = 1;
    }

    // 赛场战力要求
    const groundRequirements = {
      1: { name: '黄金赛场', power: 2000 },
      2: { name: '白银赛场', power: 1000 },
      3: { name: '青铜赛场', power: 200 },
    };

    const groundInfo = groundRequirements[groundId] || groundRequirements[1];

    try {
      console.log('[武林盟主] 执行报名，ground_id:', groundId);
      const signupHtml = await this.request('wlmz', { op: 'signup', ground_id: groundId });
      console.log('[武林盟主] 报名返回 HTML 长度:', signupHtml?.length);
      
      const signupResult = this.extractSignupResult(signupHtml);
      console.log('[武林盟主] 报名结果:', signupResult);

      const logMsg = `${groundInfo.name}报名（战力≥${groundInfo.power}）：${signupResult.message}`;

      this.log(logMsg, signupResult.success ? 'success' : 'error');

      return signupResult.success
        ? this.success({ result: `${groundInfo.name}报名成功`, ground: groundInfo.name, powerRequired: groundInfo.power })
        : this.fail(signupResult.message);
    } catch (error) {
      console.error('[武林盟主] 报名失败:', error.message);
      return this.fail(error.message);
    }
  }
}

module.exports = {
  WulinMengzhuAction,
  action: new WulinMengzhuAction(),
};
