const { ActionBase } = require('../core/action-base');

// 地盘类型映射：根据玩家等级映射地盘类型
const MANOR_TYPES = [
  { type: 1, maxLevel: 30, name: '30级以下' },
  { type: 2, maxLevel: 40, name: '40级以下' },
  { type: 3, maxLevel: 50, name: '50级以下' },
  { type: 4, maxLevel: 60, name: '60级以下' },
  { type: 5, maxLevel: 70, name: '70级以下' },
  { type: 6, maxLevel: 80, name: '80级以下' },
  { type: 7, maxLevel: 90, name: '90级以下' },
  { type: 8, maxLevel: 100, name: '100级以下' },
  { type: 9, maxLevel: 110, name: '110级以下' },
  { type: 10, maxLevel: 120, name: '120级以下' },
  { type: 11, maxLevel: 999, name: '无限制区' },
];

class ManorAction extends ActionBase {
  constructor() {
    super({
      id: 'manor',
      name: '抢地盘',
      description: '抢地盘功能：获取地盘列表、攻占地盘、领取每日奖励',
      category: '每日任务',
    });
  }

  // Get player level from the totalinfo page
  async getPlayerLevel() {
    try {
      // 使用 cmd=totalinfo 获取玩家基本信息
      const html = await this.request('totalinfo', { type: 1 });
      
      // 从HTML中匹配等级，格式: 等级:160（309220/360000）
      const levelMatch = html.match(/等级[：:]\s*(\d+)/);
      if (levelMatch && levelMatch[1]) {
        const level = parseInt(levelMatch[1], 10);
        if (!isNaN(level) && level > 0 && level < 200) {
          this.log(`获取玩家等级：${level}`, 'success');
          return level;
        }
      }
      
      this.log('未找到玩家等级，使用默认值 50', 'warn');
      return 50;
    } catch (err) {
      this.log(`获取玩家等级失败: ${err.message}，使用默认值 50`, 'warn');
      return 50;
    }
  }

  // Parse territory data from HTML using the provided regex
  parseTerritories(html) {
    const territories = [];
    if (!html) return territories;
    
    // 解码HTML实体
    const decodedHtml = html.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
    
    // 格式: 1 北京辅仁外国语大学 4级 勿斗小小YU(48级) 守0次<a href="...manorid=300116">攻占</a>
    // 修正后的正则
    const regex = /(\d+)\s+([^\d]+?)\s+(\d+)级\s+([^\(]+?)\((\d+)级\)\s*守(\d+)次[^>]*manorid=(\d+)/gi;
    let m;
    while ((m = regex.exec(decodedHtml)) !== null) {
      territories.push({
        index: parseInt(m[1], 10),
        name: (m[2] || '').trim(),
        level: parseInt(m[3], 10),
        owner: (m[4] || '').trim(),
        ownerLevel: parseInt(m[5], 10),
        defenseCount: parseInt(m[6], 10),
        manorid: parseInt(m[7], 10),
      });
    }
    
    // 备用方案：直接从链接提取manorid，再从上下文提取信息
    if (territories.length === 0) {
      const linkRegex = /cmd=manorfight[^>]*manorid=(\d+)[^>]*>[^<]*<\/a>/gi;
      let linkMatch;
      while ((linkMatch = linkRegex.exec(decodedHtml)) !== null) {
        const manorid = parseInt(linkMatch[1], 10);
        // 从链接前的文本提取信息
        const beforeLink = decodedHtml.substring(0, linkMatch.index);
        const lastBr = beforeLink.lastIndexOf('<br');
        const textAfterBr = beforeLink.substring(lastBr + 4);
        const cleanText = this.extractText(textAfterBr);
        
        // 尝试解析：序号 名称 等级 拥有者(等级) 守次数
        const simpleMatch = cleanText.match(/(\d+)\s+(.+?)\s+(\d+)级\s+(.+?)\((\d+)级\)\s*守(\d+)次/);
        if (simpleMatch) {
          territories.push({
            index: parseInt(simpleMatch[1], 10),
            name: simpleMatch[2].trim(),
            level: parseInt(simpleMatch[3], 10),
            owner: simpleMatch[4].trim(),
            ownerLevel: parseInt(simpleMatch[5], 10),
            defenseCount: parseInt(simpleMatch[6], 10),
            manorid,
          });
        } else {
          // 最简单的：只有manorid
          territories.push({
            manorid,
            name: `地盘${manorid}`,
            level: 0,
            owner: '',
            ownerLevel: 0,
            defenseCount: 0,
          });
        }
      }
    }
    
    return territories;
  }

  // Get territory list by type range (1-11)
  async getTerritories(type = 3) {
    try {
      const html = await this.request('recommendmanor', { type, page: 1 });
      const territories = this.parseTerritories(html || '');
      this.log(`获取地盘列表完成：类型=${type}，数量=${territories.length} 个`, 'success');
      return this.success(territories);
    } catch (err) {
      this.log(`Error getting territories: ${err.message}`, 'error');
      return this.fail({ error: err.message });
    }
  }

  // Get suitable manor type by level
  getSuitableType(level) {
    const lvl = typeof level === 'number' ? level : parseInt(level, 10) || 0;
    if (lvl > 120) return 11; // 超过120级使用无限制区
    for (let i = 0; i < MANOR_TYPES.length; i++) {
      if (MANOR_TYPES[i].maxLevel >= lvl) {
        return MANOR_TYPES[i].type;
      }
    }
    return 11;
  }

  // Auto fight: fetch suitable territories and attack a random one
  async autoFight(level, options = {}) {
    try {
      // If no explicit level was provided, fetch the current player level
      let playerLevel = level;
      if (typeof playerLevel !== 'number' || Number.isNaN(playerLevel)) {
        playerLevel = await this.getPlayerLevel();
      }
      const type = this.getSuitableType(playerLevel);
      this.log(`自动挑战：玩家等级=${playerLevel}，选择地盘类型=${type}`, 'info');
      const terrRes = await this.getTerritories(type);
      if (!terrRes || !terrRes.success || !Array.isArray(terrRes.data) || terrRes.data.length === 0) {
        this.log('自动挑战：获取地盘列表为空', 'warn');
        return this.fail({ error: '没有可攻占的地盘' });
      }
      const list = terrRes.data;
      const idx = Math.floor(Math.random() * list.length);
      const target = list[idx];
      this.log(`自动挑战：选择地盘 ${target.name}（守备：${target.defenseCount} 次）`, 'info');
      const atkRes = await this.attackTerritory(target.manorid);
      this.log(`自动挑战：攻占结果=${atkRes.success ? '成功' : '失败'}`, 'info');
      return atkRes;
    } catch (err) {
      this.log(`AutoFight error: ${err.message}`, 'error');
      return this.fail({ error: err.message });
    }
  }

  // Attack a territory by manorid
  async attackTerritory(manorid) {
    try {
      const html = await this.request('manorfight', { fighttype: 1, manorid });
      const ok = /(攻占成功|成功|占领|胜利)/.test(html || '');
      const info = this.extractText(html || '');
      const data = { manorid, success: ok, info: (info || '').trim() };
      if (ok) {
        this.log(`攻占地盘 ${manorid} 成功`, 'success');
        return this.success(data);
      } else {
        this.log(`攻占地盘 ${manorid} 失败`, 'error');
        return this.fail(data);
      }
    } catch (err) {
      this.log(`Attack error: ${err.message}`, 'error');
      return this.fail({ manorid, error: err.message });
    }
  }

  // Get daily reward
  async getDailyReward() {
    try {
      const html = await this.request('manorget', { type: 1 });
      const ok = /(领取|领取成功|奖励领取成功)/.test(html || '');
      const info = this.extractText(html || '');
      const data = { reward: ok, info: (info || '').trim() };
      if (ok) {
        this.log('每日奖励领取成功', 'success');
        return this.success(data);
      } else {
        this.log('每日奖励领取失败', 'error');
        return this.fail(data);
      }
    } catch (err) {
      this.log(`Reward error: ${err.message}`, 'error');
      return this.fail({ error: err.message });
    }
  }

  // Get territories owned by the player
  async getMyTerritories() {
    try {
      const html = await this.request('viewmymanor', {});
      const territories = this.parseTerritories(html || '');
      this.log(`我的地盘数量：${territories.length}`, 'success');
      return this.success({ territories });
    } catch (err) {
      this.log(`My territories error: ${err.message}`, 'error');
      return this.fail({ error: err.message });
    }
  }

  // Main runner to support multiple actions in one call
  async run(params = {}) {
    const results = {};

    // 检查是否有具体操作参数
    const hasSpecificAction = 'attack' in params || 'getReward' in params || 
                              'viewMyTerritories' in params || 'autoFight' in params ||
                              'type' in params;

    // 如果没有指定任何具体操作，默认执行自动攻占
    if (!hasSpecificAction) {
      this.log('默认执行自动攻占', 'info');
      // 不传入等级，让 autoFight 内部自行获取玩家等级
      const afRes = await this.autoFight(null, params);
      results.autoFight = afRes;
      return this.success(results);
    }

    // 以下是具体操作的处理
    if ('type' in params) {
      const res = await this.getTerritories(params.type);
      if (res.success) results.territories = res.data;
    }

    if (params.autoFight) {
      const level = params.level || 50;
      const afRes = await this.autoFight(level, params);
      results.autoFight = afRes;
    }

    if (params.attack) {
      const atkRes = await this.attackTerritory(params.attack);
      if (atkRes.success) results.attack = atkRes.data;
    }

    if (params.getReward) {
      const rewRes = await this.getDailyReward();
      if (rewRes.success) results.reward = rewRes.data;
    }

    if (params.viewMyTerritories || params.viewMy) {
      const myRes = await this.getMyTerritories();
      if (myRes.success) results.myTerritories = myRes.data;
    }

    return this.success(results);
  }
}

module.exports = { ManorAction, action: new ManorAction() };
