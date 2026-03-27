const { ActionBase } = require('../core/action-base');

class TowerFightAction extends ActionBase {
  constructor() {
    super({
      id: 'towerfight',
      name: '斗神塔',
      description: '斗神塔挑战，支持自动冲塔到100层，自动分享10倍数层奖励',
      category: '日常活动',
    });
  }

  parseStatus(html) {
    if (!html) return null;
    
    if (html.includes('ptlogin2.qq.com') || html.includes('location.replace')) {
      return { needLogin: true };
    }

    const status = {
      maxFloor: 0,
      maxScore: 0,
      title: '',
      currentFloor: 0,
      currentScore: 0,
      lastResult: '',
      reviveCount: 0,
      remainCount: '0/0',
      remainChance: 0,
      paidCount: '0/0',
      totalScore: 0,
      energy: 0,
      maxEnergy: 10000,
      monster: null,
      skill: null,
      canStart: false,
      canFight: false,
      isEnded: false,
    };

    const floorMatch = html.match(/个人最高层：(\d+)/);
    if (floorMatch) status.maxFloor = parseInt(floorMatch[1]);

    const scoreMatch = html.match(/个人最高分：(\d+)/);
    if (scoreMatch) status.maxScore = parseInt(scoreMatch[1]);

    const titleMatch = html.match(/冲塔称号：([^\s<]+)/);
    if (titleMatch) status.title = titleMatch[1];

    const resultMatch = html.match(/(秒杀|胜利|失败|结果)\s*第(\d+)层\s*(\d+)分/);
    if (resultMatch) {
      status.lastResult = resultMatch[1];
      status.currentFloor = parseInt(resultMatch[2]);
      status.currentScore = parseInt(resultMatch[3]);
    }

    const reviveMatch = html.match(/剩余复活次数：(\d+)/);
    if (reviveMatch) status.reviveCount = parseInt(reviveMatch[1]);

    const remainMatch = html.match(/今日剩余次数：(\d+)\/(\d+)/);
    if (remainMatch) {
      status.remainCount = `${remainMatch[1]}/${remainMatch[2]}`;
      status.remainChance = parseInt(remainMatch[1]);
    }

    const paidMatch = html.match(/本周付费次数：(\d+\/\d+)/);
    if (paidMatch) status.paidCount = paidMatch[1];

    const totalMatch = html.match(/冲塔积分：(\d+)/);
    if (totalMatch) status.totalScore = parseInt(totalMatch[1]);

    const energyMatch = html.match(/斗神能量[：:]\s*(\d+)\/(\d+)/);
    if (energyMatch) {
      status.energy = parseInt(energyMatch[1]);
      status.maxEnergy = parseInt(energyMatch[2]);
    }

    const monsterMatch = html.match(/怪物名称[：:]([^\s<]+)\s*怪物等级[：:](\d+)/);
    if (monsterMatch) {
      status.monster = {
        name: monsterMatch[1],
        level: parseInt(monsterMatch[2]),
      };
    }

    const skillMatch = html.match(/斗神塔技能[：:]([^<]+)<br/);
    if (skillMatch) {
      status.skill = skillMatch[1].trim();
    }

    status.canStart = html.includes('>开始挑战<') || html.includes('>开始挑战</a>');
    status.canFight = html.includes('>挑战下一层<') || html.includes('>挑战下一层</a>');
    status.isEnded = html.includes('>结束挑战<') || html.includes('>结束挑战</a>');

    return status;
  }

  async getStatus() {
    const html = await this.request('towerfight', { type: 0 });
    return this.parseStatus(html);
  }

  async fight() {
    const html = await this.request('towerfight', { type: 0 });
    return html;
  }

  async autoFight() {
    const html = await this.request('towerfight', { type: 11 });
    return html;
  }

  async revive() {
    const html = await this.request('towerfight', { type: 2 });
    if (html.includes('复活成功') || html.includes('成功')) {
      return { success: true, message: '复活成功' };
    }
    if (html.includes('复活次数不足')) {
      return { success: false, message: '复活次数不足' };
    }
    return { success: false, message: '复活失败' };
  }

  async useItem(itemId) {
    const html = await this.request('towerfight', { type: 10, id: itemId });
    if (html.includes('使用成功') || html.includes('成功')) {
      return { success: true, message: '道具使用成功' };
    }
    return { success: false, message: '道具使用失败' };
  }

  parseShareStatus(html) {
    if (!html) return null;
    
    const status = {
      current: 0,
      max: 10,
      todayCount: '0/10',
      totalCount: '0/0',
      isFull: false,
    };

    const todayMatch = html.match(/今日分享次数[：:]\s*(\d+)\/(\d+)/);
    if (todayMatch) {
      status.current = parseInt(todayMatch[1]);
      status.max = parseInt(todayMatch[2]);
      status.todayCount = `${status.current}/${status.max}`;
      status.isFull = status.current >= status.max;
    }

    const totalMatch = html.match(/分享总次数[：:]\s*(\d+\/\d+)/);
    if (totalMatch) status.totalCount = totalMatch[1];

    return status;
  }

  async shareFloor(floor) {
    const beforeStatus = await this.getShareStatus();
    const beforeCount = beforeStatus ? beforeStatus.current : 0;
    
    const html = await this.request('sharegame', { subtype: 2, shareinfo: 4 });
    
    await this.delay(300);
    const afterStatus = await this.getShareStatus();
    const afterCount = afterStatus ? afterStatus.current : beforeCount;
    
    if (afterCount > beforeCount) {
      return { success: true, message: `第${floor}层分享成功`, count: afterCount };
    }
    
    if (html.includes('已分享') || html.includes('已经分享')) {
      return { success: true, message: `第${floor}层已分享`, count: beforeCount };
    }
    
    return { success: false, message: '分享失败，可能没有达到10倍数层', count: beforeCount };
  }

  async shareOneKey() {
    const beforeStatus = await this.getShareStatus();
    const beforeCount = beforeStatus ? beforeStatus.current : 0;
    
    const html = await this.request('sharegame', { subtype: 6 });
    
    await this.delay(300);
    const afterStatus = await this.getShareStatus();
    const afterCount = afterStatus ? afterStatus.current : beforeCount;
    
    if (afterCount > beforeCount) {
      return { success: true, message: '一键分享成功', count: afterCount };
    }
    
    return { success: false, message: '一键分享失败', count: beforeCount };
  }

  async claimShareReward() {
    const html = await this.request('sharegame', { subtype: 3 });
    const results = [];
    
    const rewardPattern = /成功分享(\d+)次奖励[^&]*&nbsp;&nbsp;&nbsp;\s*<a href="[^"]*sharenums=(\d+)"[^>]*>领取<\/a>/g;
    let match;
    const rewards = [];
    
    while ((match = rewardPattern.exec(html)) !== null) {
      rewards.push({
        shareNum: parseInt(match[1]),
        id: match[2],
      });
    }

    for (const reward of rewards) {
      const claimHtml = await this.request('sharegame', { subtype: 4, sharenums: reward.id });
      if (claimHtml.includes('领取成功') || claimHtml.includes('成功') || claimHtml.includes('获得')) {
        const itemMatch = claimHtml.match(/获得[^<\n]*/);
        results.push({
          shareNum: reward.shareNum,
          success: true,
          message: itemMatch ? itemMatch[0] : '领取成功',
        });
      } else {
        results.push({
          shareNum: reward.shareNum,
          success: false,
          message: '领取失败',
        });
      }
      await this.delay(300);
    }

    const has3500Reward = rewards.some(r => r.shareNum === 3500);
    const claimed3500 = results.some(r => r.shareNum === 3500 && r.success);
    
    if (has3500Reward && claimed3500) {
      await this.delay(300);
      await this.request('sharegame', { subtype: 7 });
      results.push({
        shareNum: 3500,
        success: true,
        message: '已重置分享次数',
      });
    }

    if (results.length === 0) {
      return { success: true, message: '暂无可领取奖励', results: [] };
    }

    const successCount = results.filter(r => r.success).length;
    return {
      success: successCount > 0,
      message: `领取${successCount}/${results.length}个奖励`,
      results,
    };
  }

  async getShareStatus() {
    const html = await this.request('sharegame', { subtype: 1 });
    return this.parseShareStatus(html);
  }

  async run(params = {}) {
    const { maxFloor = 100, useRevive = false, itemId = null } = params;
    const results = [];

    try {
      let html = await this.fight();
      let status = this.parseStatus(html);
      
      if (status.needLogin) {
        return this.fail('登录已过期，请重新扫码登录');
      }

      results.push({
        action: '获取斗神塔状态',
        success: true,
        data: status,
      });

      if (status.canStart) {
        results.push({ action: '开始挑战', success: true, message: '点击开始挑战' });
      }

      if (itemId) {
        const itemResult = await this.useItem(itemId);
        results.push({
          action: '使用道具',
          success: itemResult.success,
          message: itemResult.message,
        });
      }

      let shareStatus = await this.getShareStatus();
      results.push({
        action: '获取分享状态',
        success: true,
        data: shareStatus,
      });

      const oneKeyResult = await this.shareOneKey();
      results.push({
        action: '一键分享',
        success: oneKeyResult.success,
        message: oneKeyResult.message,
      });
      
      shareStatus.current = oneKeyResult.count;
      shareStatus.isFull = shareStatus.current >= shareStatus.max;
      shareStatus.todayCount = `${shareStatus.current}/${shareStatus.max}`;

      let currentFloor = status.currentFloor || 0;
      let fightCount = 0;
      let winCount = 0;
      let failCount = 0;
      let revived = false;
      let shareCount = oneKeyResult.success ? 1 : 0;

      if (shareStatus.isFull) {
        results.push({
          action: '分享次数已满',
          success: true,
          message: `今日分享次数：${shareStatus.todayCount}，直接自动挑战`,
        });

        while (currentFloor < maxFloor) {
          html = await this.autoFight();
          status = this.parseStatus(html);
          fightCount++;

          if (status.needLogin) {
            results.push({ action: '自动挑战', success: false, message: '登录已过期' });
            break;
          }

          if (!status.canFight && !status.canStart) {
            results.push({ action: '自动挑战', success: false, message: '无法继续挑战' });
            break;
          }

          if (status.currentFloor > currentFloor) {
            winCount++;
            currentFloor = status.currentFloor;
            results.push({ action: `第${currentFloor}层`, success: true, message: `${status.lastResult || '胜利'}` });
          } else if (status.lastResult === '失败') {
            failCount++;
            results.push({ action: '自动挑战', success: false, message: '挑战失败' });
            break;
          }

          await this.delay(500);
        }
      } else {
        const needShare = shareStatus.max - shareStatus.current;
        results.push({
          action: '分享次数未满',
          success: true,
          message: `今日分享次数：${shareStatus.todayCount}，还需分享${needShare}次，手动挑战`,
        });

        while (currentFloor < maxFloor && !shareStatus.isFull) {
          html = await this.fight();
          status = this.parseStatus(html);
          fightCount++;

          if (status.needLogin) {
            results.push({ action: '挑战', success: false, message: '登录已过期' });
            break;
          }

          if (!status.canFight && !status.canStart) {
            results.push({ action: '挑战', success: false, message: '无法继续挑战' });
            break;
          }

          if (status.currentFloor > currentFloor) {
            winCount++;
            currentFloor = status.currentFloor;
            results.push({ action: `第${currentFloor}层`, success: true, message: `${status.lastResult || '胜利'}` });

            if (currentFloor > 0 && currentFloor % 10 === 0 && !shareStatus.isFull) {
              await this.delay(300);
              const shareResult = await this.shareFloor(currentFloor);
              results.push({ action: `第${currentFloor}层分享`, success: shareResult.success, message: shareResult.message });

              if (shareResult.success) {
                shareCount++;
              }
              shareStatus.current = shareResult.count;
              shareStatus.isFull = shareStatus.current >= shareStatus.max;
              shareStatus.todayCount = `${shareStatus.current}/${shareStatus.max}`;
            }
          } else if (status.lastResult === '失败') {
            failCount++;
            if (useRevive && !revived) {
              const reviveResult = await this.revive();
              if (reviveResult.success) {
                revived = true;
                results.push({ action: '复活', success: true, message: reviveResult.message });
                continue;
              }
            }
            results.push({ action: '挑战', success: false, message: '挑战失败' });
            break;
          }

          await this.delay(500);
        }

        if (shareStatus.isFull && currentFloor < maxFloor && failCount === 0) {
          results.push({ action: '分享次数已满', success: true, message: '切换自动挑战' });

          while (currentFloor < maxFloor) {
            html = await this.autoFight();
            status = this.parseStatus(html);
            fightCount++;

            if (status.needLogin) {
              results.push({ action: '自动挑战', success: false, message: '登录已过期' });
              break;
            }

            if (!status.canFight && !status.canStart) {
              results.push({ action: '自动挑战', success: false, message: '无法继续挑战' });
              break;
            }

            if (status.currentFloor > currentFloor) {
              winCount++;
              currentFloor = status.currentFloor;
              results.push({ action: `第${currentFloor}层`, success: true, message: `${status.lastResult || '胜利'}` });
            } else if (status.lastResult === '失败') {
              failCount++;
              results.push({ action: '自动挑战', success: false, message: '挑战失败' });
              break;
            }

            await this.delay(500);
          }
        }
      }

      if (shareCount > 0) {
        await this.delay(300);
        const rewardResult = await this.claimShareReward();
        results.push({ action: '领取分享奖励', success: rewardResult.success, message: rewardResult.message });
        if (rewardResult.results && rewardResult.results.length > 0) {
          rewardResult.results.forEach(r => {
            results.push({ action: `${r.shareNum}次奖励`, success: r.success, message: r.message });
          });
        }
      }

      const finalStatus = this.parseStatus(html);
      const summary = `斗神塔挑战完成：挑战${fightCount}次，成功${winCount}次，失败${failCount}次，当前第${finalStatus.currentFloor}层，分享${shareCount}次`;

      this.log(summary, failCount === 0 ? 'success' : 'warning');

      return this.success({
        result: summary,
        status: finalStatus,
        fightCount,
        winCount,
        failCount,
        shareCount,
        results,
      });

    } catch (error) {
      return this.fail(error.message);
    }
  }
}

module.exports = {
  TowerFightAction,
  action: new TowerFightAction(),
};