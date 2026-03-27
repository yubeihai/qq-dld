const { ActionBase } = require('../core/action-base');
const { friends } = require('../db');

const ENERGY_ITEMS = [
  { id: '3041', name: '真体力', points: 60 },
  { id: '3003', name: '大体力', points: 30 },
  { id: '3001', name: '小体力', points: 10 },
];

class FriendFightAction extends ActionBase {
  constructor() {
    super({
      id: 'friendfight',
      name: '乐斗好友',
      description: '乐斗好友、帮友、侠侣，体力不足自动使用药水',
      category: '好友',
    });
    
    this.defaultInterval = 500;
  }

  async useEnergyItem(itemId, itemName) {
    try {
      const html = await this.request('use', { id: itemId, store_type: '0', page: '1' });
      if (html.includes('使用成功') || html.includes('获得') || html.includes('体力')) {
        this.log(`使用${itemName}成功`, 'success');
        return { success: true, message: `使用${itemName}成功` };
      }
      if (html.includes('不足') || html.includes('没有')) {
        return { success: false, message: `${itemName}不足` };
      }
      this.log(`使用${itemName}`, 'success');
      return { success: true, message: `使用${itemName}` };
    } catch (error) {
      this.log(`使用${itemName}失败: ${error.message}`, 'error');
      return { success: false, message: `使用${itemName}失败: ${error.message}` };
    }
  }

  async tryRecoverEnergy() {
    for (const item of ENERGY_ITEMS) {
      const result = await this.useEnergyItem(item.id, item.name);
      if (result.success) {
        return { success: true, used: item.name, points: item.points };
      }
    }
    return { success: false, message: '没有可用的体力药水' };
  }

  parseFriends(html, type = 'friend') {
    if (!html) return [];
    
    const friendsList = [];
    const decodedHtml = html.replace(/&amp;/g, '&');
    
    const linkRegex = /cmd=totalinfo[^\s>]*B_UID=(\d+)[^\s>]*/g;
    let match;
    
    while ((match = linkRegex.exec(decodedHtml)) !== null) {
      const uid = match[1];
      const linkEnd = match.index + match[0].length;
      
      const nextBracket = decodedHtml.indexOf('>', linkEnd);
      if (nextBracket === -1) continue;
      
      const closeA = decodedHtml.indexOf('</a>', nextBracket);
      if (closeA === -1) continue;
      
      const name = decodedHtml.substring(nextBracket + 1, closeA).replace(/&nbsp;/g, ' ').trim();
      
      if (uid && name) {
        friendsList.push({ uid, name, type });
      }
    }
    
    return friendsList;
  }

  async scanFriends() {
    const allFriends = [];
    const seen = new Set();
    
    try {
      const html = await this.request('friendlist', { page: '1' });
      this.parseFriends(html, 'friend').forEach(f => {
        if (!seen.has(f.uid)) {
          seen.add(f.uid);
          allFriends.push({ ...f, enabled: true });
        }
      });
    } catch (e) {
      console.error('获取好友列表失败:', e.message);
    }
    
    try {
      const html = await this.request('viewmem');
      this.parseFriends(html, 'mem').forEach(f => {
        if (!seen.has(f.uid)) {
          seen.add(f.uid);
          allFriends.push({ ...f, enabled: true });
        }
      });
    } catch (e) {
      console.error('获取帮友列表失败:', e.message);
    }
    
    try {
      const html = await this.request('viewxialv');
      this.parseFriends(html, 'xialv').forEach(f => {
        if (!seen.has(f.uid)) {
          seen.add(f.uid);
          allFriends.push({ ...f, enabled: true });
        }
      });
    } catch (e) {
      console.error('获取侠侣列表失败:', e.message);
    }
    
    if (allFriends.length > 0) {
      friends.upsertBatch(allFriends);
    }
    
    return allFriends;
  }

  getSavedFriends() {
    return friends.getAll().map(f => ({
      uid: f.uid,
      name: f.name,
      type: f.type,
      enabled: f.enabled === 1,
    }));
  }

  saveFriends(friendsList) {
    friends.clear();
    if (friendsList.length > 0) {
      friends.upsertBatch(friendsList);
    }
  }

  setFriendEnabled(uid, enabled) {
    friends.setEnabled(uid, enabled);
  }

  setFriendsEnabled(uids, enabled) {
    friends.setEnabledBatch(uids, enabled);
  }

  deleteFriend(uid) {
    friends.delete(uid);
  }

  extractFightResult(html, friendName) {
    if (!html) return { success: false, result: '无响应', noEnergy: false };
    
    if (html.includes('体力值不足') || html.includes('体力不足')) {
      return { success: false, result: '❌ 体力不足', noEnergy: true };
    }
    if (html.includes('已乐斗')) {
      return { success: true, result: '⏭️ 已乐斗过', noEnergy: false };
    }
    
    const text = this.extractText(html);
    
    const defeatFriendMatch = text.match(/你击败了好友\s*([^，。!\n]+)/);
    if (defeatFriendMatch) {
      const friend = defeatFriendMatch[1].trim();
      const firstWin = text.includes('今日首胜');
      const multiMatch = text.match(/获得(\d+)倍经验(\d+)点/);
      const expMatch = text.match(/获得(?:\d+倍)?经验(\d+)点/);
      const contribMatch = text.match(/获得(?:了|同时获得)(\d+)点贡献度/);
      
      let result = '✅ ';
      result += `击败好友${friend}`;
      if (firstWin) {
        result += '(今日首胜)';
      }
      result += '，';
      if (multiMatch) {
        result += `经验+${multiMatch[2]}(${multiMatch[1]}倍)`;
      } else if (expMatch) {
        result += `经验+${expMatch[1]}`;
      }
      if (contribMatch) {
        result += `，贡献+${contribMatch[1]}`;
      }
      const extraMatch = text.match(/额外获得(\d+)点/);
      if (extraMatch) {
        result += `(额外+${extraMatch[1]})`;
      }
      return { success: true, result, noEnergy: false };
    }
    
    const friendMatch = text.match(/你主动与([^乐]+)乐斗[，,，\s]*([^。！!\n]+)/);
    if (friendMatch) {
      const friend = friendMatch[1].trim();
      const outcome = friendMatch[2].trim();
      const isWin = outcome.includes('胜') || outcome.includes('获胜') || outcome.includes('赢了');
      
      const expMatch = text.match(/获得了(\d+)点经验值/);
      const contribMatch = text.match(/获得(?:了|同时获得)(\d+)点贡献度/);
      
      let result = isWin ? '✅ ' : '❌ ';
      result += `与${friend}乐斗${isWin ? '胜' : '败'}，`;
      if (expMatch) {
        result += `经验+${expMatch[1]}`;
      }
      if (contribMatch) {
        result += `，贡献+${contribMatch[1]}`;
      }
      const extraMatch = text.match(/额外获得(\d+)点/);
      if (extraMatch) {
        result += `(额外+${extraMatch[1]})`;
      }
      return { success: true, result, noEnergy: false };
    }
    
    const bossMatch = text.match(/干掉了BOSS([^，。\n]+)/);
    if (bossMatch) {
      const expMatch = text.match(/获得了(\d+)点经验值/);
      const contribMatch = text.match(/获得了(\d+)点贡献度/);
      
      let result = '✅ ';
      result += `击败BOSS${bossMatch[1].trim()}，`;
      if (expMatch) {
        result += `经验+${expMatch[1]}`;
      }
      if (contribMatch) {
        result += `，贡献+${contribMatch[1]}`;
      }
      const extraMatch = text.match(/额外获得(\d+)点/);
      if (extraMatch) {
        result += `(额外+${extraMatch[1]})`;
      }
      return { success: true, result, noEnergy: false };
    }
    
    if (html.includes('经验药水')) {
      return { success: true, result: '✅ 获得经验药水', noEnergy: false };
    }
    if (html.includes('好感度增加')) {
      const match = html.match(/([^，]+)\s*好感度增加/);
      return { success: true, result: match ? `✅ 击败 ${match[1].trim()}，好感度+1` : '✅ 击败BOSS，好感度+1', noEnergy: false };
    }
    if (html.includes('战胜') || html.includes('击败') || html.includes('获胜')) {
      return { success: true, result: '✅ 挑战胜利', noEnergy: false };
    }
    if (html.includes('输给') || html.includes('不敌') || html.includes('失败')) {
      return { success: true, result: '❌ 挑战失败', noEnergy: false };
    }
    
    const resultMatch = text.match(/乐斗结果[：:]?\s*([^。\n]+)/);
    if (resultMatch) {
      return { success: true, result: `✅ ${resultMatch[1].trim()}`, noEnergy: false };
    }
    
    return { success: true, result: '✅ 已执行', noEnergy: false };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async run(params = {}) {
    const { uids = [], interval = this.defaultInterval, autoEnergy = true } = params;
    
    let friendsToFight = [];
    
    if (uids.length > 0) {
      const allFriends = this.getSavedFriends();
      friendsToFight = allFriends.filter(f => uids.includes(f.uid));
    } else {
      friendsToFight = this.getSavedFriends().filter(f => f.enabled);
    }
    
    if (friendsToFight.length === 0) {
      const msg = '没有要乐斗的好友，请先扫描并选择好友';
      this.log(msg, 'error');
      return this.fail(msg);
    }
    
    const results = [];
    let successCount = 0;
    let failCount = 0;
    let energyUsed = [];
    
    for (let i = 0; i < friendsToFight.length; i++) {
      const friend = friendsToFight[i];
      
      try {
        const html = await this.request('fight', {
          B_UID: friend.uid,
          page: '1',
          type: '1',
        });
        let fightResult = this.extractFightResult(html, friend.name);
        
        if (fightResult.noEnergy && autoEnergy) {
          const energyResult = await this.tryRecoverEnergy();
          if (energyResult.success) {
            energyUsed.push(energyResult.used);
            await this.sleep(1000);
            
            const retryHtml = await this.request('fight', {
              B_UID: friend.uid,
              page: '1',
              type: '1',
            });
            fightResult = this.extractFightResult(retryHtml, friend.name);
            if (fightResult.success) {
              fightResult.result += `(${energyResult.used})`;
            }
          } else {
            fightResult.result = `❌ 体力不足，${energyResult.message}`;
          }
        }
        
        results.push({ ...friend, success: fightResult.success, result: fightResult.result });
        if (fightResult.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        results.push({ ...friend, success: false, result: error.message });
        failCount++;
      }
      
      if (i < friendsToFight.length - 1 && interval > 0) {
        await this.sleep(interval);
      }
    }
    
    let summary = `乐斗：${successCount}成功，${failCount}失败`;
    if (energyUsed.length > 0) {
      summary += `，使用体力药水：${[...new Set(energyUsed)].join('、')}`;
    }
    const details = results.map(r => `${r.name}: ${r.result}`).join('\n');
    
    this.log(`${summary}\n${details}`, failCount === 0 ? 'success' : 'error');
    
    return this.success({
      result: summary,
      friends: results,
      successCount,
      failCount,
      energyUsed: [...new Set(energyUsed)],
    });
  }
}

module.exports = {
  FriendFightAction,
  action: new FriendFightAction(),
};