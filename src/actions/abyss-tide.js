const { ActionBase } = require('../core/action-base');
const { moduleConfigs } = require('../db');

const ABYSS_DUNGEONS = [
  { id: 1, name: '崎岖斗界' },
  { id: 2, name: '魂渡桥' },
  { id: 3, name: '须臾之河' },
  { id: 4, name: '曲镜空洞' },
  { id: 5, name: '光影迷界' },
  { id: 6, name: '吞厄源头' },
  { id: 7, name: '渊秘祭坛' },
  { id: 8, name: '古帝遗迹' },
];

class AbyssTideAction extends ActionBase {
  constructor() {
    super({
      id: 'abysstide',
      name: '深渊之潮',
      description: '深渊秘境副本挑战、帮派巡礼赠礼领取',
      category: '每日任务',
    });
  }

  getConfig() {
    try {
      const config = moduleConfigs.getById(this.id);
      if (!config || !config.extra_data) {
        return { dungeonId: 1, autoExchange: false };
      }
      const data = typeof config.extra_data === 'string' ? JSON.parse(config.extra_data) : config.extra_data;
      return {
        dungeonId: data.dungeonId || 1,
        autoExchange: data.autoExchange || false,
      };
    } catch (e) {
      return { dungeonId: 1, autoExchange: false };
    }
  }

  extractFactionGiftInfo(html) {
    const info = { canClaim: false, nextTime: '', factionLevel: 0 };
    
    const levelMatch = html.match(/当前帮派等级：(\d+)/);
    if (levelMatch) info.factionLevel = parseInt(levelMatch[1], 10);
    
    const nextMatch = html.match(/距离下次巡游([^<]+)/);
    if (nextMatch) info.nextTime = nextMatch[1];
    
    if (html.includes('领取巡游赠礼')) info.canClaim = true;
    
    return info;
  }

  extractAbyssInfo(html) {
    const info = {
      canEnter: false,
      enterCount: 0,
      canExchange: false,
      exchangeCount: 0,
      maxExchange: 2,
    };
    
    const countMatch = html.match(/今日可进入副本次数：(\d+)/);
    if (countMatch) {
      info.enterCount = parseInt(countMatch[1], 10);
      info.canEnter = info.enterCount > 0;
    }
    
    const exchangeMatch = html.match(/兑换(\d+)\/(\d+)次/);
    if (exchangeMatch) {
      info.exchangeCount = parseInt(exchangeMatch[1], 10);
      info.maxExchange = parseInt(exchangeMatch[2], 10);
      info.canExchange = info.exchangeCount < info.maxExchange;
    }
    
    return info;
  }

  async exchangeAccess() {
    console.log('===== 兑换挑战次数 =====');
    const html = await this.request('abysstide', { op: 'addaccess' });
    
    if (!html || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期' };
    }
    
    if (html.includes('兑换次数已用完') || html.includes('已达上限')) {
      return { success: false, message: '兑换次数已用完' };
    }
    
    if (html.includes('物品不足') || html.includes('不足')) {
      return { success: false, message: '物品不足，无法兑换' };
    }
    
    if (html.includes('成功') || html.includes('获得')) {
      const match = html.match(/获得[^<\n]*/);
      return { success: true, message: match ? match[0] : '兑换成功' };
    }
    
    return { success: true, message: '兑换成功' };
  }

  isInDungeon(html) {
    return html && html.includes('开始挑战') && html.includes('当前节点领主');
  }

  extractDungeonStatus(html) {
    const status = {
      inDungeon: false,
      dungeonName: '',
      stars: 0,
      progress: '',
      bossName: '',
      bossHp: 0,
      canSettle: false,
      cleared: false,
    };
    
    if (!html) return status;
    
    status.inDungeon = html.includes('开始挑战') && html.includes('当前节点领主');
    status.cleared = html.includes('当前状态：已通关副本');
    
    const nameMatch = html.match(/【([^】]+)】/);
    if (nameMatch) status.dungeonName = nameMatch[1];
    
    const starMatch = html.match(/★+/g);
    if (starMatch && starMatch[0]) status.stars = starMatch[0].length;
    
    const progressMatch = html.match(/(\d+)\/(\d+)当前节点领主/);
    if (progressMatch) status.progress = `${progressMatch[1]}/${progressMatch[2]}`;
    
    const bossMatch = html.match(/当前节点领主：([^<\n]+)/);
    if (bossMatch) status.bossName = bossMatch[1].trim();
    
    const hpMatch = html.match(/领主剩余血量：(\d+)/);
    if (hpMatch) status.bossHp = parseInt(hpMatch[1], 10);
    
    status.canSettle = html.includes('type=settle');
    
    return status;
  }

  async beginFight() {
    console.log('===== 开始挑战 =====');
    const html = await this.request('abysstide', { op: 'beginfight' });
    
    if (!html || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期' };
    }
    
    const text = this.extractText(html);
    console.log('战斗结果:', text.substring(0, 200));
    
    return { success: true, message: text.substring(0, 300), html, text };
  }

  async revive() {
    console.log('===== 使用复活 =====');
    
    const confirmHtml = await this.request('abysstide', { op: 'confirm', type: 'revive' });
    
    if (!confirmHtml || confirmHtml.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期' };
    }
    
    if (confirmHtml.includes('复活次数已用完') || confirmHtml.includes('无复活次数')) {
      return { success: false, message: '复活次数已用完', noRevive: true };
    }
    
    if (confirmHtml.includes('还魂丹') && confirmHtml.includes('是否确定')) {
      console.log('确认复活页面，点击确认');
      await this.delay(500);
      
      const reviveHtml = await this.request('abysstide', { op: 'revive' });
      
      if (!reviveHtml || reviveHtml.includes('ptlogin2.qq.com')) {
        return { success: false, message: '登录已过期' };
      }
      
      if (reviveHtml.includes('还魂丹不足') || reviveHtml.includes('物品不足')) {
        return { success: false, message: '还魂丹不足', noRevive: true };
      }
      
      const text = this.extractText(reviveHtml);
      console.log('复活结果:', text.substring(0, 200));
      
      return { success: true, message: '复活成功', html: reviveHtml };
    }
    
    const text = this.extractText(confirmHtml);
    console.log('复活结果:', text.substring(0, 200));
    
    return { success: true, message: text.substring(0, 100), html: confirmHtml };
  }

  isDead(html) {
    if (!html) return false;
    return html.includes('已憾负于当前节点领主') || 
           html.includes('当前状态：阵亡');
  }

  async runDungeonFight(maxReviveCount = 2) {
    let reviveCount = 0;
    let fightCount = 0;
    let fightResults = [];
    let needSettle = false;
    
    while (fightCount < 20) {
      await this.delay(500);
      const fightResult = await this.beginFight();
      fightCount++;
      
      if (!fightResult.success) {
        fightResults.push(`挑战失败: ${fightResult.message}`);
        needSettle = true;
        break;
      }
      
      const status = this.extractDungeonStatus(fightResult.html);
      
      if (status.cleared) {
        fightResults.push(`副本已通关(★★★)`);
        needSettle = true;
        break;
      }
      
      if (fightResult.text.includes('击败了') || fightResult.text.includes('可以继续探索深渊')) {
        fightResults.push(`${status.progress} ${status.bossName} 已击败`);
        
        if (status.progress === '5/5') {
          fightResults.push('副本已通关');
          needSettle = true;
          break;
        }
        continue;
      }
      
      if (this.isDead(fightResult.html)) {
        if (reviveCount < maxReviveCount) {
          await this.delay(500);
          const reviveResult = await this.revive();
          
          if (reviveResult.success) {
            reviveCount++;
            fightResults.push(`死亡，复活成功(${reviveCount}/${maxReviveCount})`);
            continue;
          } else if (reviveResult.noRevive) {
            fightResults.push('死亡，复活次数已用完，退出副本');
            needSettle = true;
            break;
          } else {
            fightResults.push(`死亡，复活失败: ${reviveResult.message}，退出副本`);
            needSettle = true;
            break;
          }
        } else {
          fightResults.push('死亡，无复活次数，退出副本');
          needSettle = true;
          break;
        }
      }
      
      if (!status.inDungeon) {
        fightResults.push('副本结束');
        break;
      }
      
      fightResults.push(`挑战${fightCount}: ${fightResult.message.substring(0, 50)}`);
    }
    
    return { fightCount, reviveCount, fightResults, needSettle };
  }

  async settleDungeon() {
    console.log('===== 结算副本 =====');
    
    const confirmHtml = await this.request('abysstide', { op: 'confirm', type: 'settle' });
    
    if (!confirmHtml || confirmHtml.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期' };
    }
    
    if (confirmHtml.includes('是否确定结算')) {
      await this.delay(500);
      const endHtml = await this.request('abysstide', { op: 'endabyss' });
      
      if (!endHtml) return { success: false, message: '结算失败' };
      
      const text = this.extractText(endHtml);
      console.log('结算结果:', text.substring(0, 200));
      
      return { success: true, message: text.substring(0, 200) };
    }
    
    const text = this.extractText(confirmHtml);
    return { success: true, message: text.substring(0, 200) };
  }

  async enterDungeon(dungeonId) {
    console.log(`===== 进入副本 dungeonId=${dungeonId} =====`);
    
    const confirmHtml = await this.request('abysstide', { 
      op: 'confirm', 
      type: 'enter', 
      id: String(dungeonId) 
    });
    
    if (!confirmHtml || confirmHtml.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期' };
    }
    
    if (confirmHtml.includes('次数不足')) {
      return { success: false, message: '进入次数不足', noCount: true };
    }
    
    await this.delay(500);
    
    const enterHtml = await this.request('abysstide', { 
      op: 'enterabyss', 
      id: String(dungeonId) 
    });
    
    if (!enterHtml || enterHtml.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期' };
    }
    
    const text = this.extractText(enterHtml);
    console.log('进入副本结果:', text.substring(0, 200));
    
    return { success: true, message: text.substring(0, 200), html: enterHtml };
  }

  async runFactionGift() {
    const giftHtml = await this.request('abysstide', { op: 'viewfactiongift' });
    const giftInfo = this.extractFactionGiftInfo(giftHtml);
    
    let giftMessage = `帮派等级${giftInfo.factionLevel}级`;
    if (giftInfo.nextTime) giftMessage += `，下次巡游${giftInfo.nextTime}`;
    
    if (giftInfo.canClaim) {
      await this.delay(500);
      const claimHtml = await this.request('abysstide', { op: 'getfactiongift' });
      
      if (!claimHtml || claimHtml.includes('ptlogin2.qq.com')) {
        return { success: false, message: '登录已过期' };
      }
      
      if (claimHtml.includes('领取成功') || claimHtml.includes('获得') || claimHtml.includes('恭喜')) {
        const match = claimHtml.match(/获得[^<\n]*/);
        return { success: true, message: `领取成功: ${match ? match[0] : '领取成功'}` };
      }
      
      return { success: true, message: '领取成功' };
    }
    
    return { success: true, message: `暂无可领取赠礼，${giftMessage}` };
  }

  async run(params = {}) {
    const results = [];
    const config = this.getConfig();
    const dungeonId = params.dungeonId || config.dungeonId || 1;
    const autoExchange = params.autoExchange !== undefined ? params.autoExchange : config.autoExchange;
    let totalEnterCount = 0;

    try {
      const html = await this.request('abysstide', {});
      if (!html || html.includes('ptlogin2.qq.com')) {
        return this.fail('登录已过期，请重新扫码登录');
      }
    } catch (error) {
      return this.fail(error.message);
    }

    try {
      const giftResult = await this.runFactionGift();
      results.push({ name: '帮派巡礼', success: giftResult.success, message: giftResult.message });
    } catch (error) {
      results.push({ name: '帮派巡礼', success: false, message: error.message });
    }

    let exchangeUsed = 0;
    const maxExchange = 2;

    while (true) {
      await this.delay(500);
      const abyssHtml = await this.request('abysstide', { op: 'viewallabyss' });
      const abyssInfo = this.extractAbyssInfo(abyssHtml);
      
      console.log(`===== 当前可进入次数: ${abyssInfo.enterCount} =====`);
      
      if (!abyssInfo.canEnter) {
        if (autoExchange && exchangeUsed < maxExchange && abyssInfo.canExchange) {
          console.log('===== 次数不足，尝试兑换 =====');
          await this.delay(500);
          const exchangeResult = await this.exchangeAccess();
          
          if (exchangeResult.success) {
            exchangeUsed++;
            results.push({ name: '兑换次数', success: true, message: exchangeResult.message });
            continue;
          } else {
            results.push({ name: '兑换次数', success: false, message: exchangeResult.message });
            break;
          }
        } else {
          console.log('===== 无可用次数，结束挑战 =====');
          break;
        }
      }

      try {
        await this.delay(500);
        const html = await this.request('abysstide', {});
        const status = this.extractDungeonStatus(html);
        
        if (!status.inDungeon) {
          console.log('===== 进入副本 =====');
          await this.delay(500);
          const enterResult = await this.enterDungeon(dungeonId);
          if (!enterResult.success) {
            results.push({ name: `深渊秘境#${totalEnterCount + 1}`, success: false, message: enterResult.message });
            break;
          }
        }
        
        console.log('===== 开始连续挑战 =====');
        const fightResult = await this.runDungeonFight(2);
        totalEnterCount++;
        
        results.push({
          name: `深渊秘境#${totalEnterCount}`,
          success: true,
          message: `挑战${fightResult.fightCount}次，复活${fightResult.reviveCount}次: ${fightResult.fightResults.join('; ')}`,
        });
        
        await this.delay(500);
        const html2 = await this.request('abysstide', {});
        const status2 = this.extractDungeonStatus(html2);
        
        if (fightResult.needSettle || status2.canSettle || status2.inDungeon) {
          await this.delay(500);
          const settleResult = await this.settleDungeon();
          console.log('结算副本:', settleResult.message);
        }
      } catch (error) {
        results.push({ name: `深渊秘境#${totalEnterCount + 1}`, success: false, message: error.message });
        break;
      }
    }

    if (totalEnterCount > 0) {
      results.push({ name: '总计', success: true, message: `共挑战${totalEnterCount}次副本，兑换${exchangeUsed}次` });
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const summary = `深渊之潮：成功${successCount}项，失败${failCount}项`;
    const details = results.map(r => `${r.name}: ${r.message}`).join('\n');
    
    this.log(`${summary}\n${details}`, failCount === 0 ? 'success' : 'error');

    return this.success({ result: summary, operations: results, successCount, failCount });
  }
}

module.exports = { AbyssTideAction, action: new AbyssTideAction(), ABYSS_DUNGEONS };