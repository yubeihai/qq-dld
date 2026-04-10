const { ActionBase } = require('../core/action-base');
const { moduleConfigs } = require('../db');

// 江湖长梦副本列表
const DUNGEONS = [
  { id: 1, name: '柒承的忙碌日常' },
  { id: 32, name: '群英拭剑谁为峰' },
  { id: 60, name: '中原武林之危' },
  { id: 59, name: '世外桃源梦一场' },
  { id: 56, name: '老鹅的圣诞冒险' },
  { id: 55, name: '南海有岛名侠客' },
  { id: 54, name: '全真古墓意难平' },
  { id: 53, name: '天涯浪子' },
  { id: 52, name: '战乱襄阳' },
  { id: 51, name: '桃花自古笑春风' },
  { id: 50, name: '雪山藏魂' },
  { id: 49, name: '神雕侠侣' },
  { id: 48, name: '倚天屠龙归我心' },
  { id: 47, name: '时空守护者' },
  { id: 43, name: '绝世秘籍之争' },
  { id: 37, name: '一骑红尘妃子笑' },
];

class JianghuDreamAction extends ActionBase {
  constructor() {
    super({
      id: 'jianghudream',
      name: '江湖长梦',
      description: '江湖长梦副本挑战，检查开放时间和材料后自动扫荡',
      category: '副本',
    });
    this.defaultInterval = 800;
  }

  /**
   * 解析副本列表页面
   */
  parseDungeonList(html) {
    if (!html) return null;

    const text = this.extractText(html);

    // 提取副本链接
    const dungeons = [];
    const regex = /cmd=jianghudream&amp;op=showCopyInfo&amp;id=(\d+)[^>]*>([^<]+)</gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const id = parseInt(match[1]);
      const name = match[2].trim();
      if (id && name) {
        dungeons.push({ id, name });
      }
    }

    return { dungeons, text };
  }

/**
   * 解析副本详情页面
   */
  parseDungeonInfo(html) {
    if (!html) return null;

    const text = this.extractText(html);

    // 提取副本名称
    const nameMatch = html.match(/副本名称[：:]\s*([^<\n]+)/i);
    const name = nameMatch ? nameMatch[1].trim() : '';

    // 提取副本时长
    const durationMatch = html.match(/副本时长[：:]\s*([^<\n]+)/i);
    const duration = durationMatch ? durationMatch[1].trim() : '';

    // 提取副本开启时间
    const openTimeMatch = html.match(/副本开启时间[：:]\s*([^<\n]+)/i);
    const openTime = openTimeMatch ? openTimeMatch[1].trim() : '';

    // 检查是否开放
    let isOpen = true;
    if (html.includes('未开放') || html.includes('暂未开放') || html.includes('已结束')) {
      isOpen = false;
    }
    // 如果是常规副本，则开放
    if (openTime && (openTime.includes('常规') || openTime.includes('永久') || openTime.includes('全年'))) {
      isOpen = true;
    }

    // 提取副本难度
    const difficultyMatch = html.match(/副本难度[：:]\s*([^<\n]+)/i);
    const difficulty = difficultyMatch ? difficultyMatch[1].trim() : '';

    // 提取可复活次数
    const reviveMatch = html.match(/可复活次数[：:]\s*(\d+)/i);
    const reviveCount = reviveMatch ? parseInt(reviveMatch[1]) : 0;

    // 提取敌人倾向
    const tendencyMatch = html.match(/敌人倾向[：:]\s*([^<\n]+)/i);
    const tendency = tendencyMatch ? tendencyMatch[1].trim() : '';

    // 提取首通奖励
    const rewardMatch = html.match(/首通奖励[：:]\s*([^<\n]+)/i);
    const firstReward = rewardMatch ? rewardMatch[1].trim() : '';

    // 检查是否有开启副本按钮
    const beginMatch = html.match(/cmd=jianghudream[^>]*op=beginInstance[^>]*ins_id=(\d+)/i);
    const hasBeginButton = beginMatch !== null;
    const instanceId = beginMatch ? beginMatch[1] : null;

    // 检查是否有领取首通奖励按钮
    const rewardLinkMatch = html.match(/cmd=jianghudream[^>]*op=getFirstReward[^>]*ins_id=(\d+)/i);
    const hasFirstReward = rewardLinkMatch !== null;

    // 检查是否有编辑队伍按钮
    const editTeamMatch = html.match(/cmd=jianghudream[^>]*op=viewMyHeros[^>]*ins_id=(\d+)/i);
    const hasEditTeam = editTeamMatch !== null;

    return {
      isOpen,
      name,
      duration,
      openTime,
      difficulty,
      reviveCount,
      tendency,
      firstReward,
      hasBeginButton,
      hasFirstReward,
      hasEditTeam,
      instanceId,
      text
    };
  }

  /**
   * 解析战斗结果
   */
  parseFightResult(html) {
    if (!html) return { success: false, result: '无响应' };

    const text = this.extractText(html);

    if (html.includes('活力值不足') || html.includes('活力不足')) {
      return { success: false, result: '活力不足', noEnergy: true };
    }

    if (html.includes('材料不足') || html.includes('道具不足') || html.includes('没有足够的')) {
      return { success: false, result: '材料不足', noMaterial: true };
    }

    if (html.includes('未开放') || html.includes('暂未开放')) {
      return { success: false, result: '副本未开放', notOpen: true };
    }

    // 胜利结果
    if (html.includes('战斗胜利') || html.includes('战胜') || html.includes('获胜') || html.includes('恭喜')) {
      const expMatch = text.match(/获得(?:\d+倍)?经验 (\d+)/);
      const itemMatch = text.match(/获得 [了「『]([^」』\n]+)[」』]?/);
      const goldMatch = text.match(/获得 (\d+) 金币/);

      let result = '✅ 战斗胜利';
      if (expMatch) result += `，经验+${expMatch[1]}`;
      if (goldMatch) result += `，金币+${goldMatch[1]}`;
      if (itemMatch) result += `，获得${itemMatch[1]}`;

      return { success: true, result, noEnergy: false };
    }

    // 失败结果
    if (html.includes('战斗失败') || html.includes('不敌') || html.includes('输了')) {
      return { success: false, result: '❌ 战斗失败', noEnergy: false };
    }

    // 扫荡结果
    if (html.includes('扫荡成功') || html.includes('完成扫荡')) {
      const expMatch = text.match(/获得(?:\d+倍)?经验 (\d+)/);
      const itemMatch = text.match(/获得 [了「『]([^」』\n]+)[」』]?/);

      let result = '✅ 扫荡完成';
      if (expMatch) result += `，经验+${expMatch[1]}`;
      if (itemMatch) result += `，获得${itemMatch[1]}`;

      return { success: true, result, noEnergy: false };
    }

    // 已完成
    if (html.includes('已完成') || html.includes('已挑战')) {
      return { success: true, result: '✅ 已完成', noEnergy: false };
    }

    // 系统繁忙
    if (html.includes('系统繁忙')) {
      return { success: false, result: '系统繁忙', retry: true };
    }

    return { success: true, result: '✅ 已执行', noEnergy: false };
  }

  /**
   * 获取副本列表
   */
  async getDungeonList() {
    try {
      const html = await this.request('jianghudream', {});
      return this.parseDungeonList(html);
    } catch (error) {
      return null;
    }
  }

  /**
   * 获取副本详情
   */
  async getDungeonInfo(dungeonId) {
    try {
      const html = await this.request('jianghudream', { op: 'showCopyInfo', id: String(dungeonId) });
      return this.parseDungeonInfo(html);
    } catch (error) {
      return null;
    }
  }

  /**
   * 开启副本（进入战斗）
   */
  async beginInstance(instanceId) {
    try {
      const html = await this.request('jianghudream', { op: 'beginInstance', ins_id: String(instanceId) });
      return this.parseFightResult(html);
    } catch (error) {
      return { success: false, result: error.message, noEnergy: false };
    }
  }

  /**
   * 领取首通奖励
   */
  async getFirstReward(instanceId) {
    try {
      const html = await this.request('jianghudream', { op: 'getFirstReward', ins_id: String(instanceId) });
      const text = this.extractText(html);
      
      if (html.includes('领取成功') || html.includes('恭喜')) {
        return { success: true, result: '✅ 首通奖励领取成功' };
      }
      if (html.includes('已领取') || html.includes('已经领取')) {
        return { success: true, result: '⏭️ 首通奖励已领取过' };
      }
      return { success: false, result: text.substring(0, 100) };
    } catch (error) {
      return { success: false, result: error.message };
    }
  }

  /**
   * 扫荡副本（使用开启副本命令）
   */
  async sweepDungeon(instanceId) {
    try {
      return await this.beginInstance(instanceId);
    } catch (error) {
      return { success: false, result: error.message, noEnergy: false };
    }
  }

  /**
   * 获取配置
   */
  getConfig() {
    const config = moduleConfigs.getById('jianghudream');
    if (!config || !config.extra_data) return { dungeonIds: [] };
    try {
      const data = JSON.parse(config.extra_data);
      return {
        dungeonIds: data.dungeonIds || [],
      };
    } catch (e) {
      return { dungeonIds: [] };
    }
  }

  /**
   * 获取可用副本列表（供前端选择）
   */
  getAvailableDungeons() {
    return DUNGEONS.map(d => ({
      id: d.id,
      name: d.name,
    }));
  }

  /**
   * 延时
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

/**
   * 执行模块
   */
  async run(params = {}) {
    const config = this.getConfig();
    const dungeonIds = params.dungeonIds || config.dungeonIds || [];
    const interval = params.interval || this.defaultInterval;

    // 检查是否选择副本
    if (dungeonIds.length === 0) {
      return this.fail('请先在模块配置中选择要挑战的副本');
    }

    const allResults = [];
    let totalSuccess = 0;
    let totalFail = 0;
    let energyDepleted = false;
    let materialDepleted = false;

    // 遍历每个副本
    for (const dungeonId of dungeonIds) {
      if (energyDepleted) {
        const dungeon = DUNGEONS.find(d => d.id === parseInt(dungeonId));
        allResults.push({ dungeon: dungeon?.name || `副本${dungeonId}`, error: '活力耗尽，跳过' });
        continue;
      }
      if (materialDepleted) {
        const dungeon = DUNGEONS.find(d => d.id === parseInt(dungeonId));
        allResults.push({ dungeon: dungeon?.name || `副本${dungeonId}`, error: '材料不足，跳过' });
        continue;
      }

      const dungeon = DUNGEONS.find(d => d.id === parseInt(dungeonId));
      if (!dungeon) {
        allResults.push({ dungeon: `副本${dungeonId}`, error: '无效的副本 ID' });
        continue;
      }

      // 获取副本详情
      const info = await this.getDungeonInfo(dungeon.id);
      if (!info) {
        allResults.push({ dungeon: dungeon.name, error: '无法获取副本信息' });
        continue;
      }

      // 先尝试领取首通奖励
      if (info.hasFirstReward && info.instanceId) {
        const rewardResult = await this.getFirstReward(info.instanceId);
        if (rewardResult.success) {
          this.log(`${dungeon.name}: ${rewardResult.result}`, 'success');
        }
      }

      // 检查是否开放
      if (!info.isOpen) {
        allResults.push({
          dungeon: dungeon.name,
          error: '副本未开放',
          openTime: info.openTime,
          duration: info.duration
        });
        continue;
      }

      // 检查是否有开启副本按钮
      if (!info.hasBeginButton || !info.instanceId) {
        allResults.push({ dungeon: dungeon.name, error: '无法开启副本' });
        continue;
      }

      // 记录副本信息
      const dungeonInfo = {
        dungeon: dungeon.name,
        id: dungeon.id,
        instanceId: info.instanceId,
        openTime: info.openTime,
        duration: info.duration,
        difficulty: info.difficulty,
        tendency: info.tendency,
        firstReward: info.firstReward,
        success: 0,
        fail: 0,
        fights: []
      };

      // 执行挑战（每个副本开启 3 次）
      for (let i = 0; i < 3; i++) {
        if (energyDepleted || materialDepleted) break;

        try {
          const fightResult = await this.beginInstance(info.instanceId);

          dungeonInfo.fights.push({
            attempt: i + 1,
            success: fightResult.success,
            result: fightResult.result,
          });

          if (fightResult.success) {
            dungeonInfo.success++;
            totalSuccess++;
          } else {
            dungeonInfo.fail++;
            totalFail++;
          }

          if (fightResult.noEnergy) {
            energyDepleted = true;
          }

          if (fightResult.noMaterial) {
            materialDepleted = true;
          }

          if (fightResult.notOpen) {
            break;
          }

          // 间隔
          if (i < 2 && !energyDepleted && !materialDepleted && interval > 0) {
            await this.sleep(interval);
          }
        } catch (error) {
          dungeonInfo.fights.push({
            attempt: i + 1,
            success: false,
            result: error.message,
          });
          dungeonInfo.fail++;
          totalFail++;
        }
      }

      allResults.push(dungeonInfo);
    }

    // 生成摘要
    let summary = `江湖长梦：${totalSuccess}胜${totalFail}败`;
    if (energyDepleted) summary += '（活力耗尽）';
    if (materialDepleted) summary += '（材料不足）';

    const details = allResults.map(r => {
      if (r.error) {
        let line = `${r.dungeon}: ${r.error}`;
        if (r.openTime) line += ` (${r.openTime})`;
        return line;
      }
      let line = `${r.dungeon}: ${r.success}胜${r.fail}败`;
      if (r.openTime) line += ` [${r.openTime}]`;
      if (r.difficulty) line += ` | 难度:${r.difficulty}`;
      if (r.tendency) line += ` | 倾向:${r.tendency}`;
      return line;
    }).join('\n');

    this.log(`${summary}\n${details}`, totalFail === 0 ? 'success' : 'error');

    return this.success({
      result: summary,
      dungeons: allResults,
      totalSuccess,
      totalFail,
      energyDepleted,
      materialDepleted,
    });
  }
}

module.exports = {
  JianghuDreamAction,
  action: new JianghuDreamAction(),
  DUNGEONS,
};