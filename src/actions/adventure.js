const { ActionBase } = require('../core/action-base');
const { moduleConfigs } = require('../db');

const MAPS = [
  { id: 1, name: '乐斗村', levelRange: '1~10级', minLevel: 1, maxLevel: 10 },
  { id: 2, name: '林松郊外', levelRange: '10~20级', minLevel: 10, maxLevel: 20 },
  { id: 3, name: '林松城', levelRange: '20~25级', minLevel: 20, maxLevel: 25 },
  { id: 4, name: '东海龙宫', levelRange: '25~30级', minLevel: 25, maxLevel: 30 },
  { id: 5, name: '踏云镇', levelRange: '30~34级', minLevel: 30, maxLevel: 34 },
  { id: 6, name: '摩云山', levelRange: '34~37级', minLevel: 34, maxLevel: 37 },
  { id: 7, name: '洞庭湖', levelRange: '37~40级', minLevel: 37, maxLevel: 40 },
  { id: 8, name: '苍莽山', levelRange: '40~44级', minLevel: 40, maxLevel: 44 },
  { id: 9, name: '玉龙湿地', levelRange: '44~47级', minLevel: 44, maxLevel: 47 },
  { id: 10, name: '玉龙雪山', levelRange: '47~50级', minLevel: 47, maxLevel: 50 },
  { id: 11, name: '狂沙台地', levelRange: '50~53级', minLevel: 50, maxLevel: 53 },
  { id: 12, name: '回声遗迹', levelRange: '53~56级', minLevel: 53, maxLevel: 56 },
  { id: 13, name: '悲叹山丘', levelRange: '57~60级', minLevel: 57, maxLevel: 60 },
  { id: 14, name: '黄沙漩涡', levelRange: '61~64级', minLevel: 61, maxLevel: 64 },
  { id: 15, name: '炎之洞窟', levelRange: '65~68级', minLevel: 65, maxLevel: 68 },
  { id: 16, name: '程管小镇', levelRange: '69~73级', minLevel: 69, maxLevel: 73 },
  { id: 17, name: '花果山', levelRange: '74~78级', minLevel: 74, maxLevel: 78 },
  { id: 18, name: '藏剑山庄', levelRange: '79~83级', minLevel: 79, maxLevel: 83 },
  { id: 19, name: '桃花剑冢', levelRange: '84~88级', minLevel: 84, maxLevel: 88 },
  { id: 20, name: '鹅王的试炼', levelRange: '89~93级', minLevel: 89, maxLevel: 93 },
];

class AdventureAction extends ActionBase {
  constructor() {
    super({
      id: 'adventure',
      name: '历练',
      description: '在世界场景中进行历练战斗，获取经验和阅历',
      category: '历练',
    });
    this.defaultInterval = 500;
  }

  parseWorldScene(html) {
    if (!html) return null;

    const text = this.extractText(html);
    
    const energyMatch = html.match(/活力值[：:]\s*(\d+)\s*\/\s*(\d+)/);
    const energy = energyMatch ? { current: parseInt(energyMatch[1]), max: parseInt(energyMatch[2]) } : null;
    
    const expMatch = html.match(/阅历值[：:]\s*(\d+)/);
    const exp = expMatch ? parseInt(expMatch[1]) : null;

    return { energy, exp, text };
  }

  parseMapScene(html) {
    if (!html) return null;

    const text = this.extractText(html);
    
    const energyMatch = html.match(/活力值[：:]\s*(\d+)\s*\/\s*(\d+)/);
    const energy = energyMatch ? { current: parseInt(energyMatch[1]), max: parseInt(energyMatch[2]) } : null;

    const monsters = [];
    const monsterRegex = /([^<>\n]+?)\s*[&nbsp;\s]*\d+\s*[&nbsp;\s]*(?:无限|\d+)\s*[&nbsp;\s]*<a[^>]*href="[^"]*cmd=mappush[^"]*subtype=3[^"]*npcid=(\d+)[^"]*"[^>]*>乐斗<\/a>/gi;
    let match;
    
    while ((match = monsterRegex.exec(html)) !== null) {
      const name = match[1].replace(/[&nbsp;]/g, '').trim();
      const npcid = match[2];
      if (name && npcid) {
        monsters.push({ npcid, name });
      }
    }

    return { monsters, energy, text };
  }

  async getMapBoss(mapId) {
    const html = await this.request('mappush', { subtype: '2', mapid: String(mapId), pageid: '2' });
    const scene = this.parseMapScene(html);
    
    if (!scene || !scene.monsters || scene.monsters.length === 0) {
      return null;
    }
    
    return scene.monsters[scene.monsters.length - 1];
  }

  extractFightResult(html) {
    if (!html) return { success: false, result: '无响应', noEnergy: false };

    if (html.includes('活力值不足') || html.includes('活力不足')) {
      return { success: false, result: '❌ 活力不足', noEnergy: true };
    }

    const text = this.extractText(html);

    const bossMatch = text.match(/你干掉了BOSS([^，。!\n]+)/);
    if (bossMatch) {
      const bossName = bossMatch[1].trim();
      const expMatch = text.match(/获得(\d+)点阅历/);
      const itemMatch = text.match(/获得([^。!\n]*?[简珠丸散丹石书符令牌碎片\*][^。!\n]*?)。/);
      
      let result = `✅ 击败BOSS ${bossName}`;
      if (expMatch) result += `，阅历+${expMatch[1]}`;
      if (itemMatch) result += `，${itemMatch[1].trim()}`;
      
      return { 
        success: true, 
        result, 
        bossName, 
        exp: expMatch ? parseInt(expMatch[1]) : 0,
        item: itemMatch ? itemMatch[1].trim() : null,
        noEnergy: false 
      };
    }

    const winMatch = text.match(/你击败了?\s*([^，。!\n]+)/);
    if (winMatch) {
      const expMatch = text.match(/获得(?:\d+倍)?经验(\d+)点?/);
      const goldMatch = text.match(/获得(\d+)金币/);
      const itemMatch = text.match(/获得[了「『]([^」』\n]+)[」』]?/);
      
      let result = `✅ 击败${winMatch[1].trim()}`;
      if (expMatch) result += `，经验+${expMatch[1]}`;
      if (goldMatch) result += `，金币+${goldMatch[1]}`;
      if (itemMatch && !expMatch) result += `，获得${itemMatch[1]}`;
      
      return { success: true, result, noEnergy: false };
    }

    if (html.includes('战斗胜利') || html.includes('战胜') || html.includes('获胜')) {
      const expMatch = text.match(/获得(?:\d+倍)?经验(\d+)点?/);
      let result = '✅ 战斗胜利';
      if (expMatch) result += `，经验+${expMatch[1]}`;
      return { success: true, result, noEnergy: false };
    }

    if (html.includes('战斗失败') || html.includes('不敌') || html.includes('输了')) {
      return { success: true, result: '❌ 战斗失败', noEnergy: false };
    }

    if (html.includes('已挑战') || html.includes('已击败')) {
      return { success: true, result: '⏭️ 已挑战过', noEnergy: false };
    }

    return { success: true, result: '✅ 已执行', noEnergy: false };
  }

  getMapByLevel(level) {
    let suitableMap = null;
    for (const map of MAPS) {
      if (level >= map.minLevel && level <= map.maxLevel) {
        suitableMap = map;
      }
    }
    if (!suitableMap) {
      suitableMap = MAPS[MAPS.length - 1];
    }
    return suitableMap;
  }

  getMapById(mapId) {
    return MAPS.find(m => m.id === parseInt(mapId));
  }

  getAvailableMaps(level) {
    return MAPS.filter(m => level >= m.minLevel).map(m => ({
      id: m.id,
      name: m.name,
      levelRange: m.levelRange,
      suitable: level >= m.minLevel && level <= m.maxLevel,
    }));
  }

  async getWorldInfo() {
    try {
      const html = await this.request('mappush', { subtype: '1' });
      return this.parseWorldScene(html);
    } catch (error) {
      return null;
    }
  }

  async fightMonster(mapId, npcid, monsterName) {
    try {
      const html = await this.request('mappush', { subtype: '3', mapid: String(mapId), npcid: String(npcid), pageid: '1' });
      return this.extractFightResult(html);
    } catch (error) {
      return { success: false, result: error.message, noEnergy: false };
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

getConfig() {
    const config = moduleConfigs.getById('adventure');
    if (!config || !config.extra_data) return { mapIds: [] };
    try {
      const data = JSON.parse(config.extra_data);
      return {
        mapIds: data.mapIds || [],
      };
    } catch (e) {
      return { mapIds: [] };
    }
  }

  async run(params = {}) {
    const config = this.getConfig();
    const mapIds = params.mapIds || config.mapIds || [];
    const interval = params.interval || this.defaultInterval;

    const worldInfo = await this.getWorldInfo();
    if (!worldInfo) {
      return this.fail('无法获取世界场景信息');
    }

    if (worldInfo.energy && worldInfo.energy.current <= 0) {
      this.log('活力值不足，无法历练', 'error');
      return this.fail('活力值不足');
    }

    if (mapIds.length === 0) {
      return this.fail('请先在模块配置中选择历练地图');
    }

    const allResults = [];
    let totalSuccess = 0;
    let totalFail = 0;
    let totalExp = 0;
    const allItems = [];
    let energyDepleted = false;

    for (const mapId of mapIds) {
      if (energyDepleted) break;

      const targetMap = this.getMapById(mapId);
      if (!targetMap) {
        allResults.push({ map: `地图${mapId}`, error: '无效的地图ID' });
        continue;
      }

      const boss = await this.getMapBoss(targetMap.id);
      if (!boss) {
        allResults.push({ map: targetMap.name, error: '无法获取Boss信息' });
        continue;
      }
      const mapResults = [];
      let mapSuccess = 0;
      let mapFail = 0;
      let mapExp = 0;
      const mapItems = [];

      for (let i = 0; i < 3; i++) {
        if (energyDepleted) break;

        try {
          const fightResult = await this.fightMonster(targetMap.id, boss.npcid, boss.name);
          
          mapResults.push({
            monster: boss.name,
            success: fightResult.success,
            result: fightResult.result,
          });

          if (fightResult.success) {
            mapSuccess++;
            if (fightResult.exp) {
              mapExp += fightResult.exp;
              totalExp += fightResult.exp;
            }
            if (fightResult.item) {
              mapItems.push(fightResult.item);
              allItems.push(fightResult.item);
            }
          } else {
            mapFail++;
          }

          if (fightResult.noEnergy) {
            energyDepleted = true;
          }
          
          if (!fightResult.success && fightResult.result.includes('次数')) {
            break;
          }
        } catch (error) {
          mapResults.push({
            monster: boss.name,
            success: false,
            result: error.message,
          });
          mapFail++;
        }

        if (i < 2 && !energyDepleted && interval > 0) {
          await this.sleep(interval);
        }
      }

      totalSuccess += mapSuccess;
      totalFail += mapFail;
      allResults.push({
        map: targetMap.name,
        boss: boss.name,
        success: mapSuccess,
        fail: mapFail,
        exp: mapExp,
        items: mapItems,
        fights: mapResults,
      });
    }

    let summary = `历练：${totalSuccess}胜${totalFail}败`;
    if (totalExp > 0) summary += `，阅历+${totalExp}`;
    if (allItems.length > 0) summary += `，获得${allItems.length}件物品`;
    if (energyDepleted) summary += '（活力耗尽）';
    
    const details = allResults.map(r => {
      if (r.error) return `${r.map}: ${r.error}`;
      let line = `${r.map}[${r.boss}]: ${r.success}胜${r.fail}败`;
      if (r.exp > 0) line += ` 阅历+${r.exp}`;
      if (r.items && r.items.length > 0) line += ` ${r.items.join(' ')}`;
      return line;
    }).join('\n');

    this.log(`${summary}\n${details}`, totalFail === 0 ? 'success' : 'error');

    return this.success({
      result: summary,
      maps: allResults,
      totalSuccess,
      totalFail,
      totalExp,
      totalItems: allItems.length,
      items: allItems,
      energyDepleted,
    });
  }
}

module.exports = {
  AdventureAction,
  action: new AdventureAction(),
  MAPS,
};