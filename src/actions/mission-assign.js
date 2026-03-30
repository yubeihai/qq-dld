const { ActionBase } = require('../core/action-base');

class MissionAssignAction extends ActionBase {
  constructor() {
    super({
      id: 'missionassign',
      name: '任务派遣',
      description: '自动处理任务派遣，优先接受S级任务，领取奖励',
      category: '每日任务',
    });
    this.defaultInterval = 1500;
  }

  parseMissionPage(html) {
    if (!html) return { currentMissions: [], availableMissions: [], canRefresh: false, refreshCost: 0 };

    const decodedHtml = html.replace(/&amp;/g, '&');
    const currentMissions = [];
    const availableMissions = [];

    const currentSection = decodedHtml.match(/当前任务<br \/>([\s\S]*?)(?=<br \/><br \/>|<br \/>\[p]|<p>)/i);
    if (currentSection) {
      const missionRegex = /([^\s<]+)&nbsp;剩余时间：(\d+) 时 (\d+) 分&nbsp;<a href="[^"]*subtype=1[^"]*mission_id=(\d+)">查看<\/a>/gi;
      let match;
      while ((match = missionRegex.exec(currentSection[1])) !== null) {
        currentMissions.push({
          name: match[1].trim(),
          remainingHours: parseInt(match[2]),
          remainingMinutes: parseInt(match[3]),
          id: match[4],
          status: 'in_progress',
        });
      }
    }

    const availableSection = decodedHtml.match(/可接受任务\（今日可接受：(\d+)\/5\）/i);
    const todayCompleted = availableSection ? parseInt(availableSection[1]) : 0;
    const remainingAcceptCount = 5 - todayCompleted;

    if (availableSection) {
      const availableRegex = /([^\s<]+)&nbsp;所需时间：(\d+) 小时&nbsp;<a href="[^"]*subtype=2[^"]*mission_id=(\d+)">接受<\/a><br \/>\n任务奖励：([^<]+)/gi;
      let match;
      while ((match = availableRegex.exec(decodedHtml)) !== null) {
        availableMissions.push({
          name: match[1].trim(),
          duration: parseInt(match[2]),
          id: match[3],
          rewards: match[4].trim(),
          difficulty: this.extractDifficulty(match[1]),
          priority: this.getPriority(match[1]),
        });
      }
    }

    const refreshMatch = decodedHtml.match(/<a href="[^"]*subtype=3[^"]*">\s*刷新任务\s*<\/a>\s*\（本次消耗：(\d+) 斗豆\）/i);
    const canRefresh = true;
    const refreshCost = refreshMatch ? parseInt(refreshMatch[1]) : 0;

    return {
      currentMissions,
      availableMissions,
      canRefresh,
      refreshCost,
      todayCompleted,
    };
  }

  extractDifficulty(name) {
    if (name.includes('-S')) return 'S';
    if (name.includes('-A')) return 'A';
    if (name.includes('-B')) return 'B';
    return '未知';
  }

  getPriority(name) {
    if (name.includes('-S')) return 1;
    if (name.includes('-A')) return 2;
    if (name.includes('-B')) return 3;
    return 99;
  }

  extractResult(html, actionType, missionId) {
    if (!html) return { success: false, message: '无响应' };

    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期，请重新扫码登录' };
    }

    if (actionType === 'claim') {
      const text = this.extractText(html);
      
      if (text.includes('领取成功') || text.includes('获得') || text.includes('恭喜')) {
        const match = text.match(/获得[^。]*/);
        return { success: true, message: match ? match[0].trim() : '领取成功', raw: text.substring(0, 200) };
      }
      if (html.includes('领取奖励') && html.includes('完成任务剩余')) {
        return { success: false, message: '任务未完成或需要先查看', raw: text.substring(0, 200) };
      }
      if (text.includes('已领取') || text.includes('已经领取')) {
        return { success: true, message: '奖励已领取', raw: text.substring(0, 200) };
      }
      if (text.includes('系统繁忙')) {
        return { success: false, message: '系统繁忙', raw: text.substring(0, 200) };
      }
      return { success: false, message: '领取失败', raw: text.substring(0, 200) };
    }

    if (actionType === 'accept') {
      if (html.includes('接受成功') || html.includes('任务派遣成功')) {
        return { success: true, message: '接受任务成功' };
      }
      if (html.includes('已达到接受上限') || html.includes('无法接受')) {
        return { success: false, message: '今日接受次数已达上限' };
      }
      if (html.includes('系统繁忙')) {
        return { success: false, message: '系统繁忙' };
      }
      return { success: false, message: '接受任务失败' };
    }

    if (actionType === 'refresh') {
      if (html.includes('刷新成功') || html.includes('任务已刷新')) {
        return { success: true, message: '刷新任务成功' };
      }
      if (html.includes('斗豆不足')) {
        return { success: false, message: '斗豆不足，无法刷新' };
      }
      return { success: false, message: '刷新失败' };
    }

    return { success: false, message: '未知操作结果' };
  }

  async getMissionList() {
    const html = await this.request('missionassign', { subtype: '0' });
    if (html.includes('ptlogin2.qq.com')) {
      throw new Error('登录已过期，请重新扫码登录');
    }
    return this.parseMissionPage(html);
  }

  async claimMissionReward(missionId) {
    const viewHtml = await this.request('missionassign', { 
      subtype: '1', 
      mission_id: String(missionId) 
    });
    
    if (viewHtml.includes('领取奖励') && viewHtml.includes('完成任务剩余：0时0分')) {
      const claimHtml = await this.request('missionassign', { 
        subtype: '5', 
        mission_id: String(missionId) 
      });
      return this.extractResult(claimHtml, 'claim', missionId);
    }
    
    return this.extractResult(viewHtml, 'claim', missionId);
  }

  async acceptMission(missionId) {
    const html = await this.request('missionassign', { 
      subtype: '2', 
      mission_id: String(missionId) 
    });
    return this.extractResult(html, 'accept', missionId);
  }

  async refreshMissions() {
    const html = await this.request('missionassign', { 
      subtype: '3' 
    });
    return this.extractResult(html, 'refresh', null);
  }

  async run(params = {}) {
    const { interval = this.defaultInterval } = params;

    let html;
    try {
      html = await this.request('missionassign', { subtype: '0' });
      if (!html || html.includes('ptlogin2.qq.com')) {
        return this.fail('登录已过期，请重新扫码登录');
      }
    } catch (error) {
      return this.fail(error.message);
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;
    let acceptedCount = 0;
    let refreshCount = 0;
    let claimedCount = 0;

    let { currentMissions, availableMissions, todayCompleted, refreshCost } = this.parseMissionPage(html);
    const remainingAcceptCount = 5 - todayCompleted;

    this.log(`[任务派遣] 今日已完成：${todayCompleted}/5，剩余次数：${remainingAcceptCount}`, 'info');
    this.log(`[任务派遣] 当前任务：${currentMissions.length}个`, 'info');

    const completedMissions = currentMissions.filter(m => m.remainingHours === 0 && m.remainingMinutes === 0);
    const inProgressMissions = currentMissions.filter(m => m.remainingHours > 0 || m.remainingMinutes > 0);

    for (const mission of completedMissions) {
      this.log(`[${mission.name}] 领取奖励...`, 'info');
      try {
        const result = await this.claimMissionReward(mission.id);
        results.push({ action: 'claim', missionName: mission.name, missionId: mission.id, ...result });
        if (result.success) {
          successCount++;
          claimedCount++;
          this.log(`[${mission.name}] 领取成功`, 'success');
        } else {
          failCount++;
          this.log(`[${mission.name}] 领取失败：${result.message}`, 'error');
        }
      } catch (error) {
        results.push({ action: 'claim', missionName: mission.name, missionId: mission.id, success: false, message: error.message });
        failCount++;
        this.log(`[${mission.name}] 领取异常：${error.message}`, 'error');
      }
      if (interval > 0) await this.delay(interval);
    }

    for (const mission of inProgressMissions) {
      this.log(`[${mission.name}] 进行中，剩余：${mission.remainingHours}时${mission.remainingMinutes}分`, 'info');
      results.push({
        action: 'in_progress',
        missionName: mission.name,
        missionId: mission.id,
        remainingTime: `${mission.remainingHours}时${mission.remainingMinutes}分`,
        success: true,
        message: '任务进行中',
      });
    }

    if (remainingAcceptCount <= 0) {
      this.log(`[任务派遣] 今日次数已用完，停止`, 'info');
      const summary = `任务派遣：领取${claimedCount}个`;
      this.log(summary, 'success');
      return this.success({ result: summary, claimedCount, successCount, failCount, todayCompleted, details: results });
    }

    const freeSlots = 3 - inProgressMissions.length;
    this.log(`[任务派遣] 空位：${freeSlots}个`, 'info');

    if (freeSlots <= 0) {
      this.log(`[任务派遣] 无空位，停止`, 'info');
      const summary = `任务派遣：领取${claimedCount}个`;
      this.log(summary, 'success');
      return this.success({ result: summary, claimedCount, successCount, failCount, todayCompleted, details: results });
    }

    html = await this.request('missionassign', { subtype: '0' });
    let parsed = this.parseMissionPage(html);
    availableMissions = parsed.availableMissions;
    refreshCost = parsed.refreshCost;

    const sortedMissions = availableMissions.sort((a, b) => a.priority - b.priority);
    const sMissions = sortedMissions.filter(m => m.difficulty === 'S');
    const aMissions = sortedMissions.filter(m => m.difficulty === 'A');
    const bMissions = sortedMissions.filter(m => m.difficulty === 'B');

    this.log(`[任务派遣] 可接受：S级${sMissions.length}个，A级${aMissions.length}个，B级${bMissions.length}个`, 'info');

    const maxCanAccept = Math.min(freeSlots, remainingAcceptCount);
    let toAccept = [];

    if (sMissions.length > 0) {
      toAccept = sMissions.slice(0, maxCanAccept);
      this.log(`[任务派遣] 有S级任务，直接接受`, 'info');
    } else if (refreshCost === 0) {
      this.log(`[任务派遣] 无S级任务，刷新（免费）...`, 'info');
      const refreshResult = await this.refreshMissions();
      results.push({ action: 'refresh', cost: 0, ...refreshResult });
      if (interval > 0) await this.delay(interval);

      if (refreshResult.success) {
        refreshCount++;
        this.log(`[任务派遣] 刷新成功`, 'success');
        html = await this.request('missionassign', { subtype: '0' });
        parsed = this.parseMissionPage(html);
        availableMissions = parsed.availableMissions;
        const newSorted = availableMissions.sort((a, b) => a.priority - b.priority);
        const newS = newSorted.filter(m => m.difficulty === 'S');
        const newA = newSorted.filter(m => m.difficulty === 'A');
        const newB = newSorted.filter(m => m.difficulty === 'B');
        this.log(`[任务派遣] 刷新后：S级${newS.length}个，A级${newA.length}个，B级${newB.length}个`, 'info');
        toAccept = newS.length > 0 ? newS.slice(0, maxCanAccept) : newA.length > 0 ? newA.slice(0, maxCanAccept) : newB.slice(0, maxCanAccept);
      } else {
        this.log(`[任务派遣] 刷新失败：${refreshResult.message}`, 'error');
        toAccept = aMissions.length > 0 ? aMissions.slice(0, maxCanAccept) : bMissions.slice(0, maxCanAccept);
      }
    } else {
      this.log(`[任务派遣] 刷新需要${refreshCost}斗豆，直接接受现有任务`, 'info');
      toAccept = aMissions.length > 0 ? aMissions.slice(0, maxCanAccept) : bMissions.slice(0, maxCanAccept);
    }

    for (const mission of toAccept) {
      try {
        this.log(`[${mission.name}] (${mission.difficulty}) 接受...`, 'info');
        const result = await this.acceptMission(mission.id);
        results.push({
          action: 'accept',
          missionName: mission.name,
          missionId: mission.id,
          difficulty: mission.difficulty,
          duration: `${mission.duration}小时`,
          rewards: mission.rewards,
          ...result,
        });
        if (result.success) {
          acceptedCount++;
          successCount++;
          this.log(`[${mission.name}] 接受成功`, 'success');
        } else {
          failCount++;
          this.log(`[${mission.name}] 接受失败：${result.message}`, 'error');
        }
      } catch (error) {
        results.push({ action: 'accept', missionName: mission.name, missionId: mission.id, success: false, message: error.message });
        failCount++;
      }
      if (interval > 0) await this.delay(interval);
    }

    const summary = `任务派遣：领取${claimedCount}个，接受${acceptedCount}个，刷新${refreshCount}次`;
    const details = results.map(r => {
      const actionLabel = r.action === 'in_progress' ? '进行中' : r.action === 'accept' ? '接受' : r.action === 'claim' ? '领取' : '刷新';
      let line = `[${actionLabel}] ${r.missionName || ''}`;
      if (r.action === 'in_progress') line += ` - ${r.remainingTime}`;
      else if (r.action === 'accept') line += ` (${r.difficulty})`;
      line += `: ${r.message || (r.success ? '成功' : '失败')}`;
      return line;
    }).join('\n');

    this.log(`${summary}\n${details}`, failCount === 0 ? 'success' : 'error');
    return this.success({
      result: summary,
      claimedCount,
      acceptedCount,
      refreshCount,
      successCount,
      failCount,
      todayCompleted: todayCompleted + acceptedCount,
      details: results,
    });
  }
}

module.exports = {
  MissionAssignAction,
  action: new MissionAssignAction(),
};
