const { ActionBase } = require('../core/action-base');

class PeakFightAction extends ActionBase {
  constructor() {
    super({
      id: 'peakfight',
      name: '巅峰之战',
      description: '巅峰之战自动领奖、加入阵营',
      category: '日常活动',
    });
  }

  parseStatus(html) {
    if (!html) return null;
    
    if (html.includes('ptlogin2.qq.com') || html.includes('location.replace')) {
      return { needLogin: true };
    }

    const status = {
      signCountdown: '',
      group: '未参加',
      reviveCount: 0,
      currentScore: 0,
      totalScore: 0,
      winCount: 0,
      winStreak: 0,
      challengeBook: 0,
      powerPill: { count: 0, max: 0 },
      swiftPearl: { count: 0, max: 0 },
      windBreath: { count: 0, max: 0 },
      activePowder: { count: 0, max: 0 },
      rules: [],
    };

    const countdownMatch = html.match(/报名时间倒计时：([^<]+)/);
    if (countdownMatch) status.signCountdown = countdownMatch[1].trim();

    const groupMatch = html.match(/所属：([^<]+)/);
    if (groupMatch) {
      const rawGroup = groupMatch[1].trim();
      status.group = rawGroup.split(/\s+/)[0];
    }

    const reviveMatch = html.match(/复活：(\d+)/);
    if (reviveMatch) status.reviveCount = parseInt(reviveMatch[1]);

    const scoreMatch = html.match(/本届战功：(\d+)/);
    if (scoreMatch) status.currentScore = parseInt(scoreMatch[1]);

    const totalScoreMatch = html.match(/当前战功：(\d+)/);
    if (totalScoreMatch) status.totalScore = parseInt(totalScoreMatch[1]);

    const winMatch = html.match(/胜利：(\d+)/);
    if (winMatch) status.winCount = parseInt(winMatch[1]);

    const streakMatch = html.match(/连胜：(\d+)/);
    if (streakMatch) status.winStreak = parseInt(streakMatch[1]);

    const itemPattern = /([\u4e00-\u9fa5]+)<a[^>]*>兑换<\/a>(?:<a[^>]*>使用<\/a>)?剩 (\d+) 次/g;
    let match;
    while ((match = itemPattern.exec(html)) !== null) {
      const itemName = match[1].trim();
      const count = parseInt(match[2]);
      if (itemName.includes('大力丸')) {
        status.powerPill = { count, max: count };
      } else if (itemName.includes('迅捷珠')) {
        status.swiftPearl = { count, max: count };
      } else if (itemName.includes('风之息')) {
        status.windBreath = { count, max: count };
      } else if (itemName.includes('活血散')) {
        status.activePowder = { count, max: count };
      }
    }

    return status;
  }

  parseRules(html) {
    if (!html) return [];
    
    const rules = [];
    
    const timeMatch = html.match(/时间：[^<]*<br \/>([^<]+)<br \/>([^<]+)<br \/>([^<]+)<br \/>([^<]+)<br \/>/);
    if (timeMatch) {
      rules.push({
        title: '时间安排',
        content: {
          sign: timeMatch[1]?.trim(),
          fight: timeMatch[2]?.trim(),
          settle: timeMatch[3]?.trim(),
          reward: timeMatch[4]?.trim(),
        },
      });
    }

    const levelMatch = html.match(/参与条件：[^<]*<br \/>([^<]+)<br \/>([^<]+)<br \/>/);
    if (levelMatch) {
      rules.push({
        title: '参与条件',
        content: {
          level: levelMatch[1]?.trim(),
          item: levelMatch[2]?.trim(),
        },
      });
    }

    const ruleItems = [];
    const rulePattern = /详细规则：[^<]*<br \/>([\s\S]*?)<\/p>/;
    const ruleMatch = html.match(rulePattern);
    if (ruleMatch) {
      const ruleText = ruleMatch[1];
      const itemMatches = ruleText.match(/<br \/>([^<]+)<br \/>/g);
      if (itemMatches) {
        itemMatches.forEach(item => {
          const text = item.replace(/<br \/>/g, '').trim();
          if (text) ruleItems.push(text);
        });
      }
    }

    if (ruleItems.length > 0) {
      rules.push({
        title: '详细规则',
        content: ruleItems,
      });
    }

    return rules;
  }

  async getStatus() {
    const html = await this.request('gvg', { sub: 0 });
    return this.parseStatus(html);
  }

  async getRules() {
    const html = await this.request('gvg', { sub: 3 });
    return this.parseRules(html);
  }

  async claimReward() {
    const beforeHtml = await this.request('gvg', { sub: 0 });
    const beforeMatch = beforeHtml.match(/<a href="[^"]*cmd=gvg&amp;sub=1">领奖<\/a>/);
    
    if (!beforeMatch) {
      return { success: true, message: '奖励已领取' };
    }

    const html = await this.request('gvg', { sub: 1 });
    
    const afterHtml = await this.request('gvg', { sub: 0 });
    const afterMatch = afterHtml.match(/<a href="[^"]*cmd=gvg&amp;sub=1">领奖<\/a>/);

    if (beforeMatch && !afterMatch) {
      return { success: true, message: '领奖成功' };
    }
    
    if (!beforeMatch) {
      return { success: true, message: '奖励已领取' };
    }

    if (html.includes('没有资格') || html.includes('不符合') || html.includes('不能领取')) {
      return { success: false, message: '没有领奖资格' };
    }
    
    return { success: false, message: '领奖失败' };
  }

  async joinGroup(group) {
    const beforeHtml = await this.request('gvg', { sub: 0 });
    const beforeGroup = beforeHtml.match(/所属：([^<]+)/);
    const beforeGroupText = beforeGroup ? beforeGroup[1].trim().split(/\s+/)[0] : '未参加';
    
    console.log('[巅峰之战] 加入前阵营状态:', beforeGroupText);
    
    if (beforeGroupText !== '未参加' && !beforeGroupText.includes('未参加')) {
      return { success: true, message: '已加入阵营' };
    }

    console.log('[巅峰之战] 执行加入请求：sub=4, group=', group);
    const html = await this.request('gvg', { sub: 4, group: group });
    console.log('[巅峰之战] 加入请求返回 HTML 长度:', html?.length);

    if (html.includes('您确定') && html.includes('确定')) {
      console.log('[巅峰之战] 需要二次确认，点击确定链接');
      const confirmUrl = html.match(/<a href="[^"]*cmd=gvg[^"]*sub=4[^"]*group=0[^"]*&amp;check=1"[^>]*>确定<\/a>/);
      if (confirmUrl) {
        console.log('[巅峰之战] 找到确认链接，执行确认');
        await this.request('gvg', { sub: 4, group: 0, check: 1 });
        await this.delay(500);
      }
    }
    
    const afterHtml = await this.request('gvg', { sub: 0 });
    const afterGroup = afterHtml.match(/所属：([^<]+)/);
    const afterGroupText = afterGroup ? afterGroup[1].trim().split(/\s+/)[0] : '未参加';

    console.log('[巅峰之战] 加入后阵营状态:', afterGroupText);

    if ((beforeGroupText === '未参加' || beforeGroupText.includes('未参加')) && 
        afterGroupText !== '未参加' && 
        !afterGroupText.includes('未参加')) {
      const groupName = group === 0 ? '随机' : group === 1 ? '南派' : '北派';
      return { success: true, message: `成功加入${groupName}` };
    }
    
    if (afterGroupText !== '未参加' && !afterGroupText.includes('未参加')) {
      return { success: true, message: '已加入阵营' };
    }

    if (html.includes('不能加入') || html.includes('无法加入') || html.includes('报名已结束')) {
      return { success: false, message: '无法加入阵营' };
    }

    if (html.includes('挑战书') || html.includes('不足') || html.includes('需要')) {
      return { success: false, message: '挑战书不足，请先兑换' };
    }
    
    return { success: false, message: '加入失败' };
  }

  async useItem(itemType) {
    const itemMap = {
      '大力丸': 3016,
      '迅捷珠': 3017,
      '风之息': 3018,
      '活血散': 3004,
    };
    const itemId = itemMap[itemType];
    if (!itemId) {
      return { success: false, message: `未知道具：${itemType}` };
    }
    const html = await this.request('gvg', { id: itemId, sub: 0 });
    if (html.includes('使用成功') || html.includes('成功使用')) {
      return { success: true, message: `${itemType}使用成功` };
    }
    if (html.includes('已用完') || html.includes('次数不足') || html.includes('剩余 0 次')) {
      return { success: false, message: `${itemType}次数不足` };
    }
    return { success: false, message: `${itemType}使用失败` };
  }

  async run(params = {}) {
    const { 
      autoClaim = true, 
      autoJoin = true, 
      group = 0,
      useItems = false,
      items = ['大力丸', '迅捷珠', '风之息', '活血散'],
    } = params;

    try {
      let html = await this.request('gvg', { sub: 0 });
      
      if (!html || html.includes('ptlogin2.qq.com')) {
        return this.fail('登录已过期，请重新扫码登录');
      }

      const status = this.parseStatus(html);
      
      console.log('[巅峰之战] 解析状态:', status);
      
      if (status.needLogin) {
        return this.fail('登录已过期，请重新扫码登录');
      }

      const results = [];
      results.push({
        action: '获取状态',
        success: true,
        data: status,
      });

      console.log('[巅峰之战] autoJoin:', autoJoin, 'status.group:', status.group);

      if (autoClaim) {
        const rewardResult = await this.claimReward();
        results.push({
          action: '自动领奖',
          success: rewardResult.success,
          message: rewardResult.message,
        });
      }

      if (autoJoin && status.group === '未参加') {
        const joinResult = await this.joinGroup(group);
        results.push({
          action: '自动加入阵营',
          success: joinResult.success,
          message: joinResult.message,
        });
      }

      if (useItems) {
        for (const item of items) {
          const itemResult = await this.useItem(item);
          results.push({
            action: `使用${item}`,
            success: itemResult.success,
            message: itemResult.message,
          });
          await this.delay(300);
        }
      }

      const summary = `巅峰之战执行完成：所属${status.group}，本届战功${status.currentScore}，当前战功${status.totalScore}，胜利${status.winCount}，连胜${status.winStreak}`;
      
      this.log(summary, 'success');

      return this.success({
        result: summary,
        status,
        results,
      });

    } catch (error) {
      return this.fail(error.message);
    }
  }
}

module.exports = {
  PeakFightAction,
  action: new PeakFightAction(),
};
