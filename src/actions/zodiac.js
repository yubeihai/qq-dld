const { ActionBase } = require('../core/action-base');
const { moduleConfigs } = require('../db');

const ZODIAC_LIST = [
  { id: 1000, name: '白羊宫', levelRange: '推荐50-55' },
  { id: 1001, name: '金牛宫', levelRange: '推荐55-60' },
  { id: 1002, name: '双子宫', levelRange: '推荐60-65' },
  { id: 1003, name: '巨蟹宫', levelRange: '推荐65-70' },
  { id: 1004, name: '狮子宫', levelRange: '推荐70-75' },
  { id: 1005, name: '处女宫', levelRange: '推荐75-80' },
  { id: 1006, name: '天秤宫', levelRange: '推荐80-85' },
  { id: 1007, name: '天蝎宫', levelRange: '推荐85-90' },
  { id: 1008, name: '射手宫', levelRange: '推荐90-95' },
  { id: 1009, name: '摩羯宫', levelRange: '推荐95-100' },
  { id: 1010, name: '水瓶宫', levelRange: '推荐101-110' },
  { id: 1011, name: '双鱼宫', levelRange: '推荐111-120' },
];

const SWEEP_TYPES = [
  { id: 0, name: '请猴王扫荡', desc: '普通扫荡' },
  { id: 1, name: '请城管扫荡', desc: '回复+1，扣50斗豆' },
  { id: 2, name: '请鹅王扫荡', desc: '回复+2，扣200斗豆' },
];

class ZodiacAction extends ActionBase {
  constructor() {
    super({
      id: 'zodiac',
      name: '天界十二宫',
      description: '扫荡天界十二宫副本，不需要活力，有次数限制',
      category: '副本',
    });
    this.defaultInterval = 800;
  }

  getZodiacById(id) {
    return ZODIAC_LIST.find(z => z.id === parseInt(id));
  }

  extractSweepPageInfo(html) {
    if (!html) return { hasSweep: false };

    const decodedHtml = html.replace(/&amp;/g, '&');

    const sweepLinkMatch = decodedHtml.match(/cmd=zodiacdungeon[^"&]*op=autofight[^"&]*scene_id=(\d+)[^"&]*pay_recover_times=(\d+)/);
    if (sweepLinkMatch) {
      return {
        hasSweep: true,
        sceneId: parseInt(sweepLinkMatch[1]),
      };
    }

    return { hasSweep: false };
  }

  extractSweepResult(html) {
    if (!html) return { success: false, message: '无响应', continue: false };

    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期，请重新扫码登录', continue: false };
    }

    if (html.includes('挑战次数不足') || html.includes('次数不足') || html.includes('次数已用完')) {
      return { success: false, message: '挑战次数不足', continue: false };
    }

    const text = this.extractText(html);

    if (html.includes('扫荡成功') || html.includes('挑战成功')) {
      const expMatch = text.match(/获得[^0-9]*(\d+)[^0-9]*经验/);
      const goldMatch = text.match(/获得[^0-9]*(\d+)[^0-9]*金/);
      const itemMatch = text.match(/获得[了「『]([^」』\n]+)[」』]?/);

      let message = '✅ 扫荡成功';
      if (expMatch) message += `，经验+${expMatch[1]}`;
      if (goldMatch) message += `，金币+${goldMatch[1]}`;
      if (itemMatch) message += `，获得${itemMatch[1]}`;

      return { success: true, message, continue: true };
    }

    if (html.includes('战斗胜利') || html.includes('击败') || html.includes('获胜')) {
      return { success: true, message: '✅ 挑战成功', continue: true };
    }

    if (html.includes('战斗失败') || html.includes('不敌') || html.includes('输了')) {
      return { success: false, message: '❌ 挑战失败', continue: true };
    }

    if (html.includes('系统繁忙')) {
      return { success: false, message: '系统繁忙', continue: true };
    }

    if (text.includes('扫荡') || text.includes('成功')) {
      return { success: true, message: '已执行', continue: true };
    }

    return { success: false, message: '未知结果', continue: false, raw: text.substring(0, 100) };
  }

  async getZodiacList() {
    const html = await this.request('zodiacdungeon', {});
    if (html.includes('ptlogin2.qq.com')) {
      throw new Error('登录已过期，请重新扫码登录');
    }

    const decodedHtml = html.replace(/&amp;/g, '&');
    const list = [];

    const regex = /cmd=zodiacdungeon[^"]*op=showautofightpage[^"]*scene_id=(\d+)[^"]*"/gi;
    let match;

    while ((match = regex.exec(decodedHtml)) !== null) {
      const sceneId = parseInt(match[1]);
      const zodiac = this.getZodiacById(sceneId);
      if (zodiac && !list.some(z => z.id === sceneId)) {
        list.push(zodiac);
      }
    }

    return list;
  }

  async showSweepPage(sceneId) {
    const html = await this.request('zodiacdungeon', {
      op: 'showautofightpage',
      scene_id: String(sceneId),
    });
    return this.extractSweepPageInfo(html);
  }

  async sweepZodiac(sceneId, payRecoverTimes = 0) {
    const html = await this.request('zodiacdungeon', {
      op: 'autofight',
      scene_id: String(sceneId),
      pay_recover_times: String(payRecoverTimes),
    });
    return this.extractSweepResult(html);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getConfig() {
    const config = moduleConfigs.getById('zodiac');
    if (!config || !config.extra_data) return { sceneIds: [], sweepType: 0 };
    try {
      const data = JSON.parse(config.extra_data);
      return {
        sceneIds: data.sceneIds || [],
        sweepType: data.sweepType || 0,
      };
    } catch (e) {
      return { sceneIds: [], sweepType: 0 };
    }
  }

  async run(params = {}) {
    const config = this.getConfig();
    const sceneIds = params.sceneIds || config.sceneIds || [];
    const sweepType = params.sweepType !== undefined ? params.sweepType : config.sweepType;
    const interval = params.interval || this.defaultInterval;

    if (sceneIds.length === 0) {
      this.log('请先在模块配置中选择要扫荡的宫殿', 'error');
      return this.fail('请先在模块配置中选择要扫荡的宫殿');
    }

    const sceneId = sceneIds[0];
    const zodiac = this.getZodiacById(sceneId);

    if (!zodiac) {
      this.log('无效的宫殿ID', 'error');
      return this.fail('无效的宫殿ID');
    }

    const sweepTypeInfo = SWEEP_TYPES.find(s => s.id === sweepType) || SWEEP_TYPES[0];

    try {
      const pageInfo = await this.showSweepPage(sceneId);

      if (!pageInfo.hasSweep) {
        const msg = '无法进入扫荡页面，次数可能已用完';
        this.log(msg, 'error');
        return this.fail(msg);
      }

      const sweeps = [];
      let successCount = 0;
      let failCount = 0;
      let continueSweep = true;

      while (continueSweep) {
        await this.sleep(interval);

        const result = await this.sweepZodiac(sceneId, sweepType);

        sweeps.push({
          success: result.success,
          message: result.message,
        });

        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }

        continueSweep = result.continue;
      }

      const summary = `${zodiac.name}(${sweepTypeInfo.name})：成功${successCount}次，失败${failCount}次`;
      const details = sweeps.map((s, i) => `第${i + 1}次: ${s.message}`).join('\n');

      this.log(`${summary}\n${details}`, failCount === 0 ? 'success' : 'error');

      return this.success({
        result: summary,
        zodiac: zodiac.name,
        levelRange: zodiac.levelRange,
        sweepType: sweepTypeInfo.name,
        sweeps,
        successCount,
        failCount,
      });

    } catch (error) {
      this.log(error.message, 'error');
      return this.fail(error.message);
    }
  }
}

module.exports = {
  ZodiacAction,
  action: new ZodiacAction(),
  ZODIAC_LIST,
  SWEEP_TYPES,
};