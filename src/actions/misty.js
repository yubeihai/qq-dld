const { ActionBase } = require('../core/action-base');
const { moduleConfigs } = require('../db');

const STAGES = [
  { id: 1, name: '乐斗村' },
  { id: 2, name: '林松郊外' },
  { id: 3, name: '林松城' },
  { id: 4, name: '东海龙宫' },
  { id: 5, name: '踏云镇' },
  { id: 6, name: '摩云山' },
  { id: 7, name: '洞庭湖' },
  { id: 8, name: '苍莽山' },
  { id: 9, name: '玉龙湿地' },
  { id: 10, name: '玉龙雪山' },
  { id: 11, name: '狂沙台地' },
  { id: 12, name: '回声遗迹' },
  { id: 13, name: '悲叹山丘' },
  { id: 14, name: '黄沙漩涡' },
  { id: 15, name: '炎之洞窟' },
  { id: 16, name: '程管小镇' },
  { id: 17, name: '花果山' },
  { id: 18, name: '藏剑山庄' },
  { id: 19, name: '桃花剑冢' },
  { id: 20, name: '鹅王的试炼' },
];

class MistyAction extends ActionBase {
  constructor() {
    super({
      id: 'misty',
      name: '缥缈幻境',
      description: '挑战缥缈幻境关卡，获取奖励',
      category: '挑战',
    });
    this.defaultInterval = 500;
  }

  parseMainPage(html) {
    if (!html) return null;

    const challengeMatch = html.match(/挑战次数[：:]\s*(\d+)\s*\/\s*(\d+)/);
    const challenges = challengeMatch ? { 
      current: parseInt(challengeMatch[1]), 
      max: parseInt(challengeMatch[2]) 
    } : null;

    const starsMatch = html.match(/累积星数[：:]\s*(\d+)/);
    const totalStars = starsMatch ? parseInt(starsMatch[1]) : 0;

    return { challenges, totalStars };
  }

  parseStagePage(html) {
    if (!html) return null;

    const stageMatch = html.match(/【([^】]+)】/);
    const stageName = stageMatch ? stageMatch[1] : '';
    
    const starsMatch = html.match(/累积星数[：:]\s*(\d+)/);
    const stars = starsMatch ? parseInt(starsMatch[1]) : 0;

    const monsters = [];
    const lines = html.split(/<br\s*\/?>/i);
    
    for (const line of lines) {
      if (line.includes('名称') || line.includes('等级') || line.includes('星数')) continue;
      if (!line.match(/\d+/)) continue;
      
      const hasFight = line.includes('cmd=misty') && line.includes('op=fight');
      
      const cleanLine = line.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
      const parts = cleanLine.split(/\s+/).filter(p => p);
      
      if (parts.length >= 3) {
        const name = parts[0];
        const level = parseInt(parts[1]);
        const monsterStars = parseInt(parts[2]);
        
        if (name && !isNaN(level) && !isNaN(monsterStars)) {
          monsters.push({
            name,
            level,
            stars: monsterStars,
            canFight: hasFight
          });
        }
      }
    }

    const isCompleted = html.includes('当前副本已结束') || html.includes('恭喜通关');
    const inProgress = html.includes('当前副本未结束');

    return { 
      stageName, 
      stars, 
      monsters, 
      isCompleted,
      inProgress
    };
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
      const starMatch = text.match(/获得(\d+)星/);
      
      let result = '✅ 战斗胜利';
      if (starMatch) result += `，${starMatch[1]}星`;
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

    if (html.includes('当前副本已结束') || html.includes('恭喜通关')) {
      return { success: true, result: '✅ 关卡已通关', stageComplete: true };
    }

    if (html.includes('当前副本未结束')) {
      return { success: true, result: '✅ 进入关卡', inProgress: true };
    }

    return { success: true, result: '✅ 已执行' };
  }

  async getMainPage() {
    try {
      const html = await this.request('misty', { op: 'return' });
      return this.parseMainPage(html);
    } catch (error) {
      return null;
    }
  }

  async enterStage(stageId) {
    try {
      const html = await this.request('misty', { op: 'start', stage_id: String(stageId) });
      return this.parseStagePage(html);
    } catch (error) {
      return null;
    }
  }

  async fightCurrent() {
    try {
      const html = await this.request('misty', { op: 'fight' });
      return this.parseFightResult(html);
    } catch (error) {
      return { success: false, result: error.message };
    }
  }

  async fightInStage(stageId) {
    const stageInfo = await this.enterStage(stageId);
    if (!stageInfo) {
      return { success: false, result: '无法进入关卡' };
    }

    if (stageInfo.isCompleted) {
      return { success: true, result: '✅ 关卡已通关', stageComplete: true };
    }

    const fights = [];
    let totalStars = 0;
    let currentMonster = stageInfo.monsters.find(m => m.canFight);
    
    while (currentMonster) {
      const fightResult = await this.fightCurrent();
      
      fights.push({
        monster: currentMonster.name,
        level: currentMonster.level,
        result: fightResult.result,
        success: fightResult.success
      });

      if (fightResult.success && fightResult.result.includes('星')) {
        const starMatch = fightResult.result.match(/(\d+)星/);
        if (starMatch) {
          totalStars += parseInt(starMatch[1]);
        }
      }

      if (fightResult.noChance) {
        return { 
          success: false, 
          result: '挑战次数不足', 
          fights,
          totalStars,
          noChance: true 
        };
      }

      if (!fightResult.success && fightResult.result.includes('战斗失败')) {
        return { 
          success: false, 
          result: `败于 ${currentMonster.name}`,
          fights,
          totalStars
        };
      }

      if (fightResult.stageComplete) {
        return { 
          success: true, 
          result: '✅ 关卡通关',
          fights,
          totalStars,
          stageComplete: true
        };
      }

      await this.sleep(this.defaultInterval);

      const updatedStage = await this.enterStage(stageId);
      if (!updatedStage) {
        break;
      }

      if (updatedStage.isCompleted) {
        return { 
          success: true, 
          result: '✅ 关卡通关',
          fights,
          totalStars,
          stageComplete: true
        };
      }

      currentMonster = updatedStage.monsters.find(m => m.canFight);
    }

    return { 
      success: true, 
      result: `挑战完成，获得${totalStars}星`,
      fights,
      totalStars
    };
  }

  getStageById(stageId) {
    return STAGES.find(s => s.id === parseInt(stageId));
  }

  getAllStages() {
    return STAGES.map(s => ({ id: s.id, name: s.name }));
  }

  getConfig() {
    const config = moduleConfigs.getById('misty');
    if (!config || !config.extra_data) return { stageIds: [] };
    try {
      const data = JSON.parse(config.extra_data);
      return {
        stageIds: data.stageIds || [],
      };
    } catch (e) {
      return { stageIds: [] };
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async run(params = {}) {
    const config = this.getConfig();
    const stageIds = params.stageIds || config.stageIds || [];
    const interval = params.interval || this.defaultInterval;

    const mainInfo = await this.getMainPage();
    if (!mainInfo) {
      return this.fail('无法获取缥缈幻境信息');
    }

    if (mainInfo.challenges && mainInfo.challenges.current <= 0) {
      this.log('挑战次数不足，无法挑战', 'error');
      return this.fail('挑战次数不足');
    }

    if (stageIds.length === 0) {
      return this.fail('请先在模块配置中选择挑战关卡');
    }

    const allResults = [];
    let totalStars = 0;
    let totalWins = 0;
    let totalFails = 0;
    let chanceDepleted = false;

    for (const stageId of stageIds) {
      if (chanceDepleted) break;

      const targetStage = this.getStageById(stageId);
      if (!targetStage) {
        allResults.push({ stage: `关卡${stageId}`, error: '无效的关卡ID' });
        continue;
      }

      const result = await this.fightInStage(targetStage.id);
      
      allResults.push({
        stage: targetStage.name,
        result: result.result,
        fights: result.fights,
        stars: result.totalStars,
        success: result.success
      });

      if (result.totalStars) {
        totalStars += result.totalStars;
      }

      if (result.fights) {
        result.fights.forEach(f => {
          if (f.success) totalWins++;
          else totalFails++;
        });
      }

      if (result.noChance) {
        chanceDepleted = true;
      }

      if (interval > 0 && !chanceDepleted) {
        await this.sleep(interval);
      }
    }

    let summary = `缥缈幻境：${totalWins}胜${totalFails}败，${totalStars}星`;
    if (chanceDepleted) summary += '（次数耗尽）';

    const details = allResults.map(r => {
      let line = `${r.stage}: ${r.result}`;
      if (r.stars) line += ` ${r.stars}星`;
      if (r.fights && r.fights.length > 0) {
        line += ` (${r.fights.map(f => `${f.monster}:${f.success ? '胜' : '败'}`).join(' ')})`;
      }
      return line;
    }).join('\n');

    this.log(`${summary}\n${details}`, totalFails === 0 ? 'success' : 'error');

    return this.success({
      result: summary,
      stages: allResults,
      totalStars,
      totalWins,
      totalFails,
      chanceDepleted,
    });
  }
}

module.exports = {
  MistyAction,
  action: new MistyAction(),
  STAGES,
};