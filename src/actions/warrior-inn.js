const { ActionBase } = require('../core/action-base');
const { exchangeTypes, exchangeConfigs } = require('../db');

class WarriorInnAction extends ActionBase {
  constructor() {
    super({
      id: 'warriorinn',
      name: '侠士客栈',
      description: '侠士客栈：自动领取一层打尖和二层住店奖励',
      category: '每日任务',
    });
    this.defaultInterval = 500;
  }

  extractText(html) {
    if (!html) return '';
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  parseMainPage(html) {
    if (!html) return { success: false, message: '无响应' };

    if (html.includes('ptlogin2.qq.com') || html.includes('location.replace')) {
      return { success: false, message: '登录已过期' };
    }

    const text = this.extractText(html);
    const info = {};

    // 客栈豪华度
    const luxuryMatch = text.match(/客栈豪华度[【\[]?(\d+)[】\]]?/);
    if (luxuryMatch) {
      info.luxury = parseInt(luxuryMatch[1]);
    }

    // 一层打尖 - 桌位列表（需要查看后才能领取）
    const tables = [];
    const tableRegex = /(\d+)号桌.*?op=getlobbyinfo&amp;num=(\d+)/gi;
    let tableMatch;
    while ((tableMatch = tableRegex.exec(html)) !== null) {
      tables.push({
        num: parseInt(tableMatch[2]),
        desc: `${tableMatch[1]}号桌`,
      });
    }

    // 二层住店 - 房间奖励（主页直接领取）
    const roomRewards = [];
    const roomRegex = /op=getlobbyreward&amp;type=2&amp;num=(\d+)/gi;
    let roomMatch;
    while ((roomMatch = roomRegex.exec(html)) !== null) {
      roomRewards.push({
        num: parseInt(roomMatch[1]),
        desc: `房间${roomMatch[1]}`,
      });
    }

    // 客栈奇遇 - 黑市商人等
    const adventures = [];
    const adventureRegex = /op=showAdventure&amp;pos=(\d+)/gi;
    let adventureMatch;
    while ((adventureMatch = adventureRegex.exec(html)) !== null) {
      adventures.push({
        pos: parseInt(adventureMatch[1]),
        desc: `奇遇位置${adventureMatch[1]}`,
      });
    }

    // 检测"一探究竟"链接（客栈建设）
    const hasExplore = html.includes('cmd=notice') && html.includes('op=view');

    return { success: true, info, tables, roomRewards, adventures, hasExplore, text };
  }

  parseLobbyInfo(html) {
    if (!html) return { success: false, message: '无响应', hasReward: false };

    if (html.includes('ptlogin2.qq.com') || html.includes('location.replace')) {
      return { success: false, message: '登录已过期', hasReward: false };
    }

    const text = this.extractText(html);

    // 检查是否有领取奖励链接
    const hasReward = html.includes('op=getlobbyreward');

    // 提取桌位状态信息
    const statusMatch = text.match(/(\d+)号桌[：:]?\s*([^\n]+)/);
    const status = statusMatch ? statusMatch[2].trim() : '';

    return { success: true, hasReward, status, text };
  }

  parseActionResult(html) {
    if (!html) return { success: false, message: '无响应' };

    if (html.includes('ptlogin2.qq.com') || html.includes('location.replace')) {
      return { success: false, message: '登录已过期' };
    }

    const text = this.extractText(html);

    // 成功判断
    if (text.includes('成功') || text.includes('完成') || text.includes('获得')) {
      const match = text.match(/([^。\n]{0,50}(成功|完成|获得)[^。\n]{0,50})/);
      return { success: true, message: match ? match[1] : '领取成功', text };
    }

    // 已领取判断
    if (text.includes('已领取') || text.includes('已获得')) {
      return { success: true, message: '已领取', text };
    }

    // 失败判断
    if (text.includes('失败') || text.includes('不足') || text.includes('无法') || text.includes('不能')) {
      const match = text.match(/([^。\n]{0,50}(失败|不足|无法|不能)[^。\n]{0,50})/);
      return { success: false, message: match ? match[1] : '领取失败', text };
    }

    return { success: true, message: '已执行', text };
  }

  async getLobbyInfo(num) {
    const html = await this.request('warriorinn', { op: 'getlobbyinfo', num: String(num) });
    return { html, ...this.parseLobbyInfo(html) };
  }

  async claimReward(type, num) {
    const html = await this.request('warriorinn', {
      op: 'getlobbyreward',
      type: String(type),
      num: String(num),
    });
    return this.parseActionResult(html);
  }

  // 查看客栈建设页面（一探究竟）
  async viewNotice() {
    const html = await this.request('notice', { op: 'view' });
    return this.parseNoticePage(html);
  }

  parseNoticePage(html) {
    if (!html) return { success: false, message: '无响应' };

    if (html.includes('ptlogin2.qq.com') || html.includes('location.replace')) {
      return { success: false, message: '登录已过期' };
    }

    const text = this.extractText(html);
    const info = {};

    // 建设进度
    const progressMatch = text.match(/(\d+)级建设进度[：:]?\s*(\d+)\s*\/\s*(\d+)/);
    if (progressMatch) {
      info.level = parseInt(progressMatch[1]);
      info.progress = parseInt(progressMatch[2]);
      info.maxProgress = parseInt(progressMatch[3]);
    }

    // 今日酒肉分量
    const wineMatch = text.match(/今日酒肉分量[：:]?\s*(\d+)\s*\/\s*(\d+)/);
    if (wineMatch) {
      info.wine = { current: parseInt(wineMatch[1]), max: parseInt(wineMatch[2]) };
    }

    // 今日帮助次数
    const helpMatch = text.match(/今日帮助次数[：:]?\s*(\d+)\s*\/\s*(\d+)/);
    if (helpMatch) {
      info.helpCount = { current: parseInt(helpMatch[1]), max: parseInt(helpMatch[2]) };
    }

    // 可选操作
    const choices = [];
    const choiceRegex = /cmd=notice&amp;op=choice&amp;optid=(\d+)/gi;
    let choiceMatch;
    while ((choiceMatch = choiceRegex.exec(html)) !== null) {
      const optid = parseInt(choiceMatch[1]);
      const names = { 1: '添砖', 2: '加瓦', 3: '摸鱼', 4: '捣乱' };
      choices.push({
        optid,
        name: names[optid] || `选项${optid}`,
      });
    }

    return { success: true, info, choices, text };
  }

  // 随机帮助一次
  async doRandomHelp() {
    const noticeResult = await this.viewNotice();

    if (!noticeResult.success) {
      return { success: false, message: noticeResult.message };
    }

    // 检查是否还有帮助次数
    if (noticeResult.info.helpCount && noticeResult.info.helpCount.current >= noticeResult.info.helpCount.max) {
      return { success: true, message: '今日帮助次数已用完', info: noticeResult.info };
    }

    // 随机选择一个操作
    if (noticeResult.choices && noticeResult.choices.length > 0) {
      const randomChoice = noticeResult.choices[Math.floor(Math.random() * noticeResult.choices.length)];
      const html = await this.request('notice', { op: 'choice', optid: String(randomChoice.optid) });
      const result = this.parseActionResult(html);
      return {
        success: result.success,
        message: result.message,
        action: randomChoice.name,
        info: noticeResult.info,
      };
    }

    return { success: false, message: '无可选操作' };
  }

  // 查看共建回馈页面
  async viewTotalReward() {
    const html = await this.request('notice', { op: 'view', sub: 'total' });
    return this.parseTotalRewardPage(html);
  }

  parseTotalRewardPage(html) {
    if (!html) return { success: false, message: '无响应', rewards: [] };

    if (html.includes('ptlogin2.qq.com') || html.includes('location.replace')) {
      return { success: false, message: '登录已过期', rewards: [] };
    }

    const rewards = [];

    // 解析所有可领取的奖励链接
    // 格式类似: cmd=notice&op=claimreward&level=X 或其他格式
    const rewardRegex = /cmd=notice&amp;op=claimreward[^"]*level=(\d+)[^"]*"[^>]*>领取<\/a>/gi;
    let rewardMatch;
    while ((rewardMatch = rewardRegex.exec(html)) !== null) {
      rewards.push({
        level: parseInt(rewardMatch[1]),
        desc: `${rewardMatch[1]}级建设回馈`,
      });
    }

    // 如果上面的正则没匹配到，尝试另一种格式
    if (rewards.length === 0) {
      // 可能链接格式不同，尝试通用匹配
      const altRegex = /(\d+)级建设回馈[^<]*<a[^>]*cmd=notice[^>]*op=[^>]*>[^<]*<\/a>/gi;
      let altMatch;
      while ((altMatch = altRegex.exec(html)) !== null) {
        const level = parseInt(altMatch[1]);
        const linkHtml = altMatch[0];
        // 提取op参数
        const opMatch = linkHtml.match(/op=(\w+)/);
        if (opMatch) {
          rewards.push({
            level,
            op: opMatch[1],
            desc: `${level}级建设回馈`,
          });
        }
      }
    }

    const text = this.extractText(html);
    return { success: true, rewards, text };
  }

  // 领取建设回馈奖励
  async claimTotalReward(level) {
    const html = await this.request('notice', { op: 'claimreward', level: String(level) });
    return this.parseActionResult(html);
  }

  // 自动领取所有共建回馈奖励
  async claimAllTotalRewards() {
    const totalResult = await this.viewTotalReward();

    if (!totalResult.success) {
      return { success: false, message: totalResult.message, results: [] };
    }

    const results = [];

    if (totalResult.rewards && totalResult.rewards.length > 0) {
      for (const reward of totalResult.rewards) {
        await this.delay(this.defaultInterval);
        const claimResult = await this.claimTotalReward(reward.level);
        results.push({
          level: reward.level,
          desc: reward.desc,
          success: claimResult.success,
          message: claimResult.message,
        });
      }
    }

    const summary = results.map(r => `${r.desc}: ${r.message}`).join('\n');
    return {
      success: true,
      message: summary || '无可领取奖励',
      results,
    };
  }

  // ========== 客栈奇遇 ==========

  // 查看奇遇详情
  async viewAdventure(pos) {
    const html = await this.request('warriorinn', { op: 'showAdventure', pos: String(pos) });
    return this.parseAdventurePage(html);
  }

  // 解析奇遇页面
  parseAdventurePage(html) {
    if (!html) return { success: false, message: '无响应' };

    if (html.includes('ptlogin2.qq.com') || html.includes('location.replace')) {
      return { success: false, message: '登录已过期' };
    }

    const text = this.extractText(html);
    const info = {};

    // 奇遇类型
    if (text.includes('物品交换')) {
      info.type = 'exchange';
      info.typeName = '物品交换';
    } else if (text.includes('寻衅滋事')) {
      info.type = 'fight';
      info.typeName = '寻衅滋事';
    } else if (text.includes('特价道具')) {
      info.type = 'special';
      info.typeName = '特价道具';
    } else {
      info.type = 'unknown';
      info.typeName = '未知类型';
    }

    // 提取交换信息（物品交换类型）
    // 格式: "你这里有没有多余的还魂丹*30？我想拿时之沙*2跟你交换一下"
    const exchangeMatch = text.match(/有没有多余的([^？*]+)\*(\d+).*拿([^*]+)\*(\d+)/);
    if (exchangeMatch) {
      info.giveItem = exchangeMatch[1].trim();
      info.giveCount = parseInt(exchangeMatch[2]);
      info.getItem = exchangeMatch[3].trim();
      info.getCount = parseInt(exchangeMatch[4]);
      info.exchangeDesc = `${info.giveItem}*${info.giveCount} → ${info.getItem}*${info.getCount}`;
    }

    // 剩余时间
    const timeMatch = text.match(/剩余时间[：:]?\s*(\d{2}):(\d{2}):(\d{2})/);
    if (timeMatch) {
      info.remainingHours = parseInt(timeMatch[1]);
      info.remainingMinutes = parseInt(timeMatch[2]);
      info.remainingSeconds = parseInt(timeMatch[3]);
      info.remainingTime = `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`;
    }

    // 可选操作
    const actions = [];
    const actionRegex = /op=confirmadventure&amp;pos=(\d+)&amp;type=(\d+)/gi;
    let actionMatch;
    while ((actionMatch = actionRegex.exec(html)) !== null) {
      const type = parseInt(actionMatch[2]);
      const names = { 0: '接受交换', 1: '拒绝交换' };
      actions.push({
        pos: parseInt(actionMatch[1]),
        type,
        name: names[type] || `操作${type}`,
      });
    }

    return { success: true, info, actions, text };
  }

  // 执行奇遇操作
  async doAdventure(pos, actionType) {
    const html = await this.request('warriorinn', {
      op: 'confirmadventure',
      pos: String(pos),
      type: String(actionType),
    });
    return this.parseActionResult(html);
  }

  // 生成交换ID
  generateExchangeId(giveItem, getItem) {
    // 使用物品名称生成ID，过滤特殊字符
    const normalize = (str) => str.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
    return `${normalize(giveItem)}_换_${normalize(getItem)}`;
  }

  // 保存发现的交换类型到数据库
  saveExchangeType(info) {
    if (!info.giveItem || !info.getItem) return;

    const id = this.generateExchangeId(info.giveItem, info.getItem);
    const existing = exchangeTypes.getById(id);

    if (!existing) {
      exchangeTypes.upsert(id, info.giveItem, info.giveCount, info.getItem, info.getCount);
    }

    return id;
  }

  // 判断是否应该接受交换（使用数据库配置）
  shouldAcceptExchange(info, defaultStrategy = 'reject') {
    if (!info.giveItem || !info.getItem) {
      return defaultStrategy === 'accept';
    }

    // 保存发现的交换类型
    const exchangeId = this.saveExchangeType(info);

    // 从数据库读取配置
    return exchangeConfigs.shouldAccept(exchangeId);
  }

  // 判断是否应该接受交换（支持传入配置对象，兼容旧逻辑）
  shouldAcceptExchangeWithConfig(info, strategyConfig = null) {
    // 如果传入配置对象，使用旧逻辑
    if (strategyConfig && typeof strategyConfig === 'object') {
      const {
        acceptGetItems = [],
        rejectGiveItems = [],
        acceptGiveItems = [],
        rules = [],
        defaultStrategy = 'reject',
      } = strategyConfig;

      if (!info.giveItem || !info.getItem) {
        return defaultStrategy === 'accept';
      }

      // 优先检查自定义规则
      for (const rule of rules) {
        if (rule.give && info.giveItem.includes(rule.give)) {
          if (rule.giveMax && info.giveCount > rule.giveMax) {
            return rule.action === 'accept';
          }
          if (rule.giveMin && info.giveCount < rule.giveMin) {
            continue;
          }
          if (rule.action) {
            return rule.action === 'accept';
          }
        }
        if (rule.get && info.getItem.includes(rule.get)) {
          if (rule.getMin && info.getCount < rule.getMin) {
            continue;
          }
          if (rule.getMax && info.getCount > rule.getMax) {
            continue;
          }
          if (rule.action) {
            return rule.action === 'accept';
          }
        }
      }

      for (const item of rejectGiveItems) {
        if (info.giveItem.includes(item)) {
          return false;
        }
      }

      for (const item of acceptGetItems) {
        if (info.getItem.includes(item)) {
          return true;
        }
      }

      for (const item of acceptGiveItems) {
        if (info.giveItem.includes(item)) {
          return true;
        }
      }

      return defaultStrategy === 'accept';
    }

    // 使用数据库配置
    return this.shouldAcceptExchange(info, strategyConfig || 'reject');
  }

  // 自动处理奇遇（支持定制策略）
  async handleAdventure(pos, strategyConfig = null) {
    const adventureResult = await this.viewAdventure(pos);

    if (!adventureResult.success) {
      return { success: false, message: adventureResult.message };
    }

    const info = adventureResult.info;

    // 物品交换类型 - 根据策略决定
    if (info.type === 'exchange') {
      const shouldAccept = this.shouldAcceptExchangeWithConfig(info, strategyConfig);
      const actionType = shouldAccept ? 0 : 1;
      const action = adventureResult.actions.find(a => a.type === actionType);

      if (action) {
        await this.delay(this.defaultInterval);
        const result = await this.doAdventure(pos, actionType);
        return {
          success: result.success,
          message: result.message,
          exchange: info.exchangeDesc,
          action: action.name,
          accepted: shouldAccept,
        };
      }
    }

    // 其他类型暂不自动处理
    return {
      success: true,
      message: `奇遇类型: ${info.typeName}`,
      info,
    };
  }

  // 处理所有奇遇
  async handleAllAdventures(adventures, strategyConfig = null) {
    const results = [];

    if (adventures && adventures.length > 0) {
      for (const adventure of adventures) {
        await this.delay(this.defaultInterval);
        const result = await this.handleAdventure(adventure.pos, strategyConfig);
        results.push({
          pos: adventure.pos,
          desc: adventure.desc,
          success: result.success,
          message: result.message,
          exchange: result.exchange,
          action: result.action,
          accepted: result.accepted,
        });
      }
    }

    return { success: true, results };
  }

  async run(params = {}) {
    const results = [];

    // 1. 加载主页
    const html = await this.request('warriorinn', {});
    const mainResult = this.parseMainPage(html);

    if (!mainResult.success) {
      this.log(`侠士客栈: ${mainResult.message}`, 'error');
      return this.fail(mainResult.message);
    }

    results.push({
      action: '加载主页',
      success: true,
      message: `客栈豪华度: ${mainResult.info.luxury || '未知'}`,
    });

    // 2. 一层打尖 - 查看每个桌子，检查是否有奖励
    if (mainResult.tables && mainResult.tables.length > 0) {
      for (const table of mainResult.tables) {
        await this.delay(this.defaultInterval);
        const lobbyResult = await this.getLobbyInfo(table.num);

        if (lobbyResult.hasReward) {
          await this.delay(this.defaultInterval);
          const claimResult = await this.claimReward(1, table.num);
          results.push({
            action: '领取桌位奖励',
            success: claimResult.success,
            desc: table.desc,
            message: claimResult.message,
          });
        } else {
          results.push({
            action: '查看桌位',
            success: true,
            desc: table.desc,
            message: lobbyResult.status || '无奖励',
          });
        }
      }
    }

    // 3. 二层住店 - 领取房间奖励
    if (mainResult.roomRewards && mainResult.roomRewards.length > 0) {
      for (const room of mainResult.roomRewards) {
        await this.delay(this.defaultInterval);
        const claimResult = await this.claimReward(2, room.num);
        results.push({
          action: '领取房间奖励',
          success: claimResult.success,
          desc: room.desc,
          message: claimResult.message,
        });
      }
    }

    // 4. 客栈奇遇 - 处理黑市商人等
    if (mainResult.adventures && mainResult.adventures.length > 0) {
      const adventureResults = await this.handleAllAdventures(mainResult.adventures);
      for (const adv of adventureResults.results) {
        results.push({
          action: '客栈奇遇',
          success: adv.success,
          desc: adv.exchange || adv.desc,
          message: `${adv.accepted ? '接受' : '拒绝'}: ${adv.message}`,
        });
      }
    }

    // 5. 一探究竟 - 随机帮助一次
    if (mainResult.hasExplore) {
      await this.delay(this.defaultInterval);
      const helpResult = await this.doRandomHelp();
      results.push({
        action: '客栈建设',
        success: helpResult.success,
        desc: helpResult.action || '',
        message: helpResult.message,
      });

      // 6. 共建回馈 - 领取所有建设奖励
      await this.delay(this.defaultInterval);
      const totalResult = await this.claimAllTotalRewards();
      if (totalResult.results && totalResult.results.length > 0) {
        for (const reward of totalResult.results) {
          results.push({
            action: '领取建设回馈',
            success: reward.success,
            desc: reward.desc,
            message: reward.message,
          });
        }
      } else {
        results.push({
          action: '查看共建回馈',
          success: true,
          message: totalResult.message,
        });
      }
    }

    // 生成日志摘要
    const summary = results.map(r => `${r.action}: ${r.desc ? `[${r.desc}] ` : ''}${r.message}`).join('\n');
    this.log(`侠士客栈自动执行:\n${summary}`, 'success');

    return this.success({
      info: mainResult.info,
      results,
      message: summary,
    });
  }
}

module.exports = {
  WarriorInnAction,
  action: new WarriorInnAction(),
};