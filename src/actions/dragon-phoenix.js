const { ActionBase } = require('../core/action-base');

class DragonPhoenixAction extends ActionBase {
  constructor() {
    super({
      id: 'dragonphoenix',
      name: '龙凰之境',
      description: '龙凰之境：龙凰论武、龙凰云集、龙吟破阵、凰鸣百锻',
      category: '挑战',
    });
    this.defaultInterval = 500;
  }

  parseIndexPage(html) {
    if (!html) return null;
    
    const features = [];
    
    if (html.includes('op=lunwu')) {
      features.push({ id: 'lunwu', name: '龙凰论武', available: true });
    }
    if (html.includes('op=yunji')) {
      features.push({ id: 'yunji', name: '龙凰云集', available: true });
    }
    if (html.includes('op=formationindex')) {
      features.push({ id: 'formationindex', name: '龙吟破阵', available: true });
    }
    if (html.includes('op=baiduan')) {
      features.push({ id: 'baiduan', name: '凰鸣百锻', available: true });
    }
    
    return { features };
  }

  getSeasonStatus() {
    const now = new Date();
    const day = now.getDate();
    const hour = now.getHours();
    
    if (day >= 1 && day < 4) {
      return { status: 'signup', name: '报名期' };
    }
    
    if (day === 4 && hour < 8) {
      return { status: 'signup', name: '报名期' };
    }
    
    if (day >= 4 && day <= 25) {
      if (day === 4 && hour < 8) {
        return { status: 'preparing', name: '准备期' };
      }
      if (hour >= 8 && hour < 22) {
        return { status: 'battle', name: '比赛期' };
      }
      return { status: 'battle_closed', name: '比赛期（挑战关闭）' };
    }
    
    if (day >= 26) {
      if (day === 26 && hour < 22) {
        return { status: 'rest_preparing', name: '休赛期（结算中）' };
      }
      return { status: 'rest', name: '休赛期' };
    }
    
    return { status: 'unknown', name: '未知' };
  }

  parseLunwuPage(html) {
    if (!html) return null;
    
    const text = this.extractText(html);
    
    const divisionMatch = html.match(/赛区[：:]\s*([^<\n]+)/);
    const division = divisionMatch ? divisionMatch[1].trim() : '';
    
    const notSignedUp = division.includes('未参赛');
    
    const rankMatch = html.match(/赛季位次[：:]\s*(\d+)/);
    const rank = rankMatch ? parseInt(rankMatch[1]) : 0;
    
    const scoreMatch = html.match(/赛季积分[：:]\s*(\d+)/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
    
    const rankListMatch = html.match(/赛季积分排名[：:]\s*([^<\n]+)/);
    const rankList = rankListMatch ? rankListMatch[1].trim() : '';
    
    const timesMatch = html.match(/剩余挑战次数[：:]\s*(\d+)/);
    const times = timesMatch ? parseInt(timesMatch[1]) : 0;
    
    const confirmMatch = html.match(/获取挑战次数[^\d]*(\d+)\/(\d+)/);
    const confirmTimes = confirmMatch ? {
      current: parseInt(confirmMatch[1]),
      max: parseInt(confirmMatch[2])
    } : null;
    
    const seasonEnd = html.includes('赛季即将结束') || html.includes('无法参与挑战');
    const canConfirm = html.includes('op=confirm') && confirmTimes && confirmTimes.current < confirmTimes.max;
    
    const canGift = html.includes('op=gift');
    
    const canSignUp = html.includes('龙渊') || html.includes('凰极');
    
    const canRestReward = html.includes('休赛期') && html.includes('领取');
    
    return { 
      division,
      notSignedUp,
      rank,
      score,
      rankList,
      times,
      confirmTimes,
      seasonEnd,
      canConfirm,
      canGift,
      canSignUp,
      canRestReward
    };
  }

  parseYunjiPage(html) {
    if (!html) return null;
    
    const text = this.extractText(html);
    
    const pointsMatch = html.match(/当前龙凰点[：:]\s*(\d+)/);
    const points = pointsMatch ? parseInt(pointsMatch[1]) : 0;
    
    const fightCountMatch = html.match(/赛季论武次数[：:]\s*(\d+)/);
    const fightCount = fightCountMatch ? parseInt(fightCountMatch[1]) : 0;
    
    const rewardThresholds = [1, 8, 18, 26, 36];
    const availableRewards = [];
    
    const rewardPattern = /(\d+)\s*<a[^>]*?op=reward[^>]*?idx=(\d+)[^>]*>([^<]+)<\/a>/gi;
    let rewardMatch;
    
    while ((rewardMatch = rewardPattern.exec(html)) !== null) {
      const threshold = parseInt(rewardMatch[1]);
      const idx = parseInt(rewardMatch[2]);
      const text = rewardMatch[3].trim();
      
      if (fightCount >= threshold) {
        availableRewards.push({ threshold, idx, text, canClaim: true });
      }
    }
    
    const simpleRewardPattern = /(\d+)\s*<a[^>]*?op=reward[^>]*>([^<]+)<\/a>/gi;
    let simpleRewardMatch;
    while ((simpleRewardMatch = simpleRewardPattern.exec(html)) !== null) {
      const threshold = parseInt(simpleRewardMatch[1]);
      const text = simpleRewardMatch[2].trim();
      
      if (fightCount >= threshold && !availableRewards.find(r => r.threshold === threshold)) {
        availableRewards.push({ threshold, text, canClaim: true });
      }
    }
    
    const exchanges = [];
    const exchangePattern = /([^<(]+)\((\d+)龙凰点\)\s*剩余\s*(\d+)\/(\d+)/g;
    let exchangeMatch;
    
    while ((exchangeMatch = exchangePattern.exec(html)) !== null) {
      exchanges.push({
        name: exchangeMatch[1].trim(),
        cost: parseInt(exchangeMatch[2]),
        remaining: parseInt(exchangeMatch[3]),
        max: parseInt(exchangeMatch[4])
      });
    }
    
    return { 
      points, 
      fightCount, 
      availableRewards,
      exchanges
    };
  }

  parseFormationPage(html) {
    if (!html) return null;
    
    const text = this.extractText(html);
    
    const levelMatch = html.match(/当前层数[：:]\s*(\d+)/);
    const level = levelMatch ? parseInt(levelMatch[1]) : 0;
    
    const timesMatch = html.match(/挑战次数[：:]\s*(\d+)\s*\/\s*(\d+)/);
    const times = timesMatch ? {
      current: parseInt(timesMatch[1]),
      max: parseInt(timesMatch[2])
    } : null;
    
    const canFight = html.includes('op=fight');
    
    return { level, times, canFight };
  }

  parseBaiduanPage(html) {
    if (!html) return null;
    
    const text = this.extractText(html);
    
    const timesMatch = html.match(/锻造次数[：:]\s*(\d+)\s*\/\s*(\d+)/);
    const times = timesMatch ? {
      current: parseInt(timesMatch[1]),
      max: parseInt(timesMatch[2])
    } : null;
    
    const canForge = html.includes('op=forge') || html.includes('锻造');
    
    return { times, canForge };
  }

  parseFightResult(html) {
    if (!html) return { success: false, result: '无响应' };
    
    const text = this.extractText(html);
    
    if (html.includes('挑战次数不足') || html.includes('次数已用完')) {
      return { success: false, result: '❌ 挑战次数不足', noChance: true };
    }
    
    if (html.includes('战斗胜利') || html.includes('战胜') || html.includes('获胜') || html.includes('你击败了')) {
      const expMatch = text.match(/获得(?:\d+倍)?经验(\d+)/);
      const goldMatch = text.match(/获得(\d+)金币/);
      const itemMatch = text.match(/获得[了「『]?([^」』\n]+?)[」』]?[。！]/);
      
      let result = '✅ 战斗胜利';
      if (expMatch) result += `，经验+${expMatch[1]}`;
      if (goldMatch) result += `，金币+${goldMatch[1]}`;
      if (itemMatch && !itemMatch[1].includes('经验') && !itemMatch[1].includes('金币')) {
        result += `，${itemMatch[1].trim()}`;
      }
      
      return { success: true, result, noChance: false };
    }
    
    if (html.includes('战斗失败') || html.includes('不敌') || html.includes('输了')) {
      return { success: false, result: '❌ 战斗失败', noChance: false };
    }
    
    return { success: true, result: '✅ 已执行' };
  }

  async getIndexPage() {
    try {
      const html = await this.request('dragonphoenix', { op: 'index' });
      return this.parseIndexPage(html);
    } catch (error) {
      return null;
    }
  }

  async doLunwu() {
    try {
      const seasonStatus = this.getSeasonStatus();
      const html = await this.request('dragonphoenix', { op: 'lunwu' });
      const info = this.parseLunwuPage(html);
      
      if (!info) {
        return { success: false, result: '无法获取龙凰论武信息' };
      }
      
      const results = [`📅 ${seasonStatus.name}`];
      
      if (seasonStatus.status === 'signup' && info.notSignedUp && info.canSignUp) {
        const links = this.extractLinks(html);
        const signUpLinks = links.filter(link => 
          link.url && 
          (link.url.includes('龙渊') || link.url.includes('凰极') || link.text.includes('龙渊') || link.text.includes('凰极'))
        );
        
        if (signUpLinks.length > 0) {
          const targetLink = signUpLinks[0];
          try {
            const signUpHtml = await this.fetchUrl(targetLink.url);
            if (signUpHtml.includes('成功') || signUpHtml.includes('报名')) {
              results.push('✅ 自动报名成功');
            } else {
              results.push('⚠️ 报名失败，请手动选择赛区');
            }
          } catch (e) {
            results.push('⚠️ 报名失败');
          }
          return { success: true, result: results.join('\n') };
        }
        
        return { success: false, result: '请在报名期内选择赛区报名' };
      }
      
      if (seasonStatus.status === 'rest' && info.canRestReward) {
        const links = this.extractLinks(html);
        const rewardLink = links.find(link => link.url && link.url.includes('领取'));
        if (rewardLink) {
          try {
            const rewardHtml = await this.fetchUrl(rewardLink.url);
            if (rewardHtml.includes('成功') || rewardHtml.includes('获得')) {
              results.push('✅ 领取休赛期奖励成功');
            }
          } catch (e) {
            results.push('⚠️ 领取休赛期奖励失败');
          }
        }
        return { success: true, result: results.join('\n') };
      }
      
      if (seasonStatus.status === 'rest' || seasonStatus.status === 'rest_preparing') {
        return { success: true, result: results.join('\n') + '\n休赛期中，等待新赛季开始' };
      }
      
      if (seasonStatus.status === 'battle_closed') {
        return { success: true, result: results.join('\n') + '\n挑战时间：每日8:00-22:00' };
      }
      
      if (seasonStatus.status === 'preparing') {
        return { success: true, result: results.join('\n') + '\n比赛即将开始' };
      }
      
      if (info.seasonEnd) {
        return { success: false, result: '❌ 赛季即将结束，无法参与挑战' };
      }
      
      if (info.notSignedUp) {
        return { success: false, result: '❌ 未报名参赛' };
      }
      
      if (info.canGift) {
        const links = this.extractLinks(html);
        const giftLink = links.find(link => link.url && link.url.includes('op=gift'));
        if (giftLink) {
          try {
            const giftHtml = await this.fetchUrl(giftLink.url);
            if (giftHtml.includes('成功') || giftHtml.includes('领取')) {
              results.push('✅ 领取每日奖励');
            }
          } catch (e) {
            results.push('⚠️ 领取每日奖励失败');
          }
        }
      }
      
      if (info.times <= 0 && info.canConfirm) {
        const links = this.extractLinks(html);
        const confirmLink = links.find(link => link.url && link.url.includes('op=confirm'));
        if (confirmLink) {
          try {
            const confirmHtml = await this.fetchUrl(confirmLink.url);
            if (confirmHtml.includes('成功') || confirmHtml.includes('获得')) {
              results.push('✅ 获取挑战次数');
              await this.sleep(this.defaultInterval);
              
              const newHtml = await this.request('dragonphoenix', { op: 'lunwu' });
              const newInfo = this.parseLunwuPage(newHtml);
              if (newInfo && newInfo.times > 0) {
                info.times = newInfo.times;
              }
            }
          } catch (e) {
            results.push('⚠️ 获取挑战次数失败');
          }
        }
      }
      
      if (info.times <= 0) {
        return { 
          success: false, 
          result: results.join('\n') + '\n❌ 挑战次数不足', 
          noChance: true 
        };
      }
      
      const fightLinks = this.extractLinks(html);
      const fightLink = fightLinks.find(link => link.url && link.url.includes('op=fight'));
      
      if (fightLink) {
        const fightHtml = await this.fetchUrl(fightLink.url);
        const result = this.parseFightResult(fightHtml);
        results.push(result.result);
        return { success: result.success, result: results.join('\n'), noChance: result.noChance };
      }
      
      return { 
        success: true, 
        result: results.length > 1 ? results.join('\n') : '✅ 龙凰论武已处理'
      };
    } catch (error) {
      return { success: false, result: error.message };
    }
  }

  async doYunji() {
    try {
      const html = await this.request('dragonphoenix', { op: 'yunji' });
      const info = this.parseYunjiPage(html);
      
      if (!info) {
        return { success: false, result: '无法获取龙凰云集信息' };
      }
      
      const results = [];
      results.push(`龙凰点: ${info.points}`);
      results.push(`论武次数: ${info.fightCount}`);
      
      if (info.availableRewards && info.availableRewards.length > 0) {
        const links = this.extractLinks(html);
        
        for (const reward of info.availableRewards) {
          const rewardLink = links.find(link => 
            link.url && 
            link.url.includes('op=reward') && 
            (reward.idx ? link.url.includes(`idx=${reward.idx}`) : link.text.includes('领奖'))
          );
          
          if (rewardLink) {
            try {
              const rewardHtml = await this.fetchUrl(rewardLink.url);
              if (rewardHtml.includes('成功') || rewardHtml.includes('获得') || rewardHtml.includes('领取')) {
                results.push(`✅ 领取${reward.threshold}次奖励成功`);
              } else {
                results.push(`⚠️ 领取${reward.threshold}次奖励失败`);
              }
              await this.sleep(this.defaultInterval);
            } catch (e) {
              results.push(`⚠️ 领取${reward.threshold}次奖励异常`);
            }
          }
        }
      }
      
      return { 
        success: true, 
        result: results.join('\n')
      };
    } catch (error) {
      return { success: false, result: error.message };
    }
  }

  async doFormation() {
    try {
      const html = await this.request('dragonphoenix', { op: 'formationindex' });
      const info = this.parseFormationPage(html);
      
      if (!info) {
        return { success: false, result: '无法获取龙吟破阵信息' };
      }
      
      if (info.times && info.times.current <= 0) {
        return { success: false, result: '❌ 挑战次数不足', noChance: true };
      }
      
      if (info.canFight) {
        const fightLinks = this.extractLinks(html);
        const fightLink = fightLinks.find(link => link.url && link.url.includes('op=fight'));
        
        if (fightLink) {
          const fightHtml = await this.fetchUrl(fightLink.url);
          const result = this.parseFightResult(fightHtml);
          return result;
        }
      }
      
      return { success: true, result: `✅ 当前层数: ${info.level}` };
    } catch (error) {
      return { success: false, result: error.message };
    }
  }

  async doBaiduan() {
    try {
      const html = await this.request('dragonphoenix', { op: 'baiduan' });
      const info = this.parseBaiduanPage(html);
      
      if (!info) {
        return { success: false, result: '无法获取凰鸣百锻信息' };
      }
      
      if (info.times && info.times.current <= 0) {
        return { success: false, result: '❌ 锻造次数不足', noChance: true };
      }
      
      if (info.canForge) {
        const forgeLinks = this.extractLinks(html);
        const forgeLink = forgeLinks.find(link => link.url && link.url.includes('op=forge'));
        
        if (forgeLink) {
          const forgeHtml = await this.fetchUrl(forgeLink.url);
          return { success: true, result: '✅ 锻造成功' };
        }
      }
      
      return { success: true, result: '✅ 凰鸣百锻已处理' };
    } catch (error) {
      return { success: false, result: error.message };
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async run(params = {}) {
    const features = params.features || ['lunwu', 'yunji', 'formation', 'baiduan'];
    const results = [];
    let hasError = false;
    
    const indexInfo = await this.getIndexPage();
    if (!indexInfo) {
      return this.fail('无法获取龙凰之境信息');
    }
    
    for (const feature of features) {
      let result;
      
      switch (feature) {
        case 'lunwu':
          result = await this.doLunwu();
          results.push({ feature: '龙凰论武', ...result });
          break;
          
        case 'yunji':
          result = await this.doYunji();
          results.push({ feature: '龙凰云集', ...result });
          break;
          
        case 'formation':
          result = await this.doFormation();
          results.push({ feature: '龙吟破阵', ...result });
          break;
          
        case 'baiduan':
          result = await this.doBaiduan();
          results.push({ feature: '凰鸣百锻', ...result });
          break;
          
        default:
          results.push({ feature, success: false, result: '未知功能' });
      }
      
      if (!result || !result.success) {
        hasError = true;
      }
      
      await this.sleep(this.defaultInterval);
    }
    
    const successCount = results.filter(r => r.success).length;
    const summary = `龙凰之境: ${successCount}/${results.length} 功能完成`;
    
    this.log(summary, hasError ? 'error' : 'success');
    
    return this.success({
      result: summary,
      details: results,
    });
  }
}

module.exports = {
  DragonPhoenixAction,
  action: new DragonPhoenixAction(),
};