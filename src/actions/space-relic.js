const { ActionBase } = require('../core/action-base');

const MONSTERS = [
  { id: 1, name: '异兽幼崽' },
  { id: 2, name: '异兽战士' },
  { id: 3, name: '异兽将领' },
  { id: 4, name: '异兽元帅' },
  { id: 5, name: '异兽母巢' },
];

class SpaceRelicAction extends ActionBase {
  constructor() {
    super({
      id: 'spacerelic',
      name: '时空遗迹',
      description: '异兽洞窟、联合征伐、八卦迷阵、舆图探宝、天象洗髓、悬赏任务、遗迹商店',
      category: '时空遗迹',
    });
  }

  extractText(html) {
    if (!html) return '';
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  parseGoosipResult(html) {
    if (!html) return { success: false, message: '无响应' };
    
    if (html.includes('活力不足') || html.includes('活力值不足')) {
      return { success: false, message: '活力不足', noEnergy: true };
    }

    if (html.includes('成功') || html.includes('获得') || html.includes('恭喜')) {
      const text = this.extractText(html);
      const itemMatch = text.match(/获得([^，。\n]+)/);
      return { success: true, message: itemMatch ? `获得${itemMatch[1].trim()}` : '挑战成功' };
    }

    if (html.includes('失败') || html.includes('不敌')) {
      return { success: true, message: '挑战失败' };
    }

    if (html.includes('已完成') || html.includes('已挑战') || html.includes('次数不足')) {
      return { success: true, message: '已完成或次数不足' };
    }

    return { success: false, message: '未知结果', raw: this.extractText(html).substring(0, 100) };
  }

  parseMaptreasureResult(html) {
    if (!html) return { success: false, message: '无响应' };
    
    if (html.includes('活力不足') || html.includes('活力值不足')) {
      return { success: false, message: '活力不足', noEnergy: true };
    }

    if (html.includes('成功') || html.includes('获得') || html.includes('恭喜') || html.includes('探宝')) {
      const text = this.extractText(html);
      const itemMatch = text.match(/获得([^，。\n]+)/);
      return { success: true, message: itemMatch ? `获得${itemMatch[1].trim()}` : '探宝成功' };
    }

    if (html.includes('已完成') || html.includes('次数不足')) {
      return { success: true, message: '已完成或次数不足' };
    }

    return { success: false, message: '未知结果', raw: this.extractText(html).substring(0, 100) };
  }

  parseWashingResult(html) {
    if (!html) return { success: false, message: '无响应' };
    
    if (html.includes('成功') || html.includes('洗髓') || html.includes('提升')) {
      const text = this.extractText(html);
      const attrMatch = text.match(/([^，。\n]+?)\s*(\+?\d+)/);
      return { success: true, message: attrMatch ? `${attrMatch[1].trim()}` : '洗髓成功' };
    }

    if (html.includes('材料不足') || html.includes('资源不足')) {
      return { success: false, message: '材料不足' };
    }

    return { success: false, message: '未知结果', raw: this.extractText(html).substring(0, 100) };
  }

  parseMonsterResult(html) {
    if (!html) return { success: false, message: '无响应' };
    
    if (html.includes('活力不足') || html.includes('活力值不足')) {
      return { success: false, message: '活力不足', noEnergy: true };
    }

    if (html.includes('成功') || html.includes('获得') || html.includes('恭喜') || html.includes('战胜')) {
      const text = this.extractText(html);
      const itemMatch = text.match(/获得([^，。\n]+)/);
      return { success: true, message: itemMatch ? `获得${itemMatch[1].trim()}` : '挑战成功' };
    }

    if (html.includes('失败') || html.includes('不敌')) {
      return { success: true, message: '挑战失败' };
    }

    if (html.includes('已完成') || html.includes('次数不足') || html.includes('已挑战')) {
      return { success: true, message: '已完成或次数不足' };
    }

    return { success: false, message: '未知结果', raw: this.extractText(html).substring(0, 100) };
  }

  parseUnionResult(html) {
    if (!html) return { success: false, message: '无响应' };
    
    if (html.includes('活力不足') || html.includes('活力值不足')) {
      return { success: false, message: '活力不足', noEnergy: true };
    }

    if (html.includes('成功') || html.includes('获得') || html.includes('恭喜') || html.includes('战胜')) {
      const text = this.extractText(html);
      const itemMatch = text.match(/获得([^，。\n]+)/);
      return { success: true, message: itemMatch ? `获得${itemMatch[1].trim()}` : '征伐成功' };
    }

    if (html.includes('失败') || html.includes('不敌')) {
      return { success: true, message: '征伐失败' };
    }

    if (html.includes('已完成') || html.includes('次数不足')) {
      return { success: true, message: '已完成或次数不足' };
    }

    return { success: false, message: '未知结果', raw: this.extractText(html).substring(0, 100) };
  }

  parseMonsterDetail(html) {
    if (!html) return null;

    const hpMatch = html.match(/剩余血量[：:]\s*(\d+)/);
    const hp = hpMatch ? parseInt(hpMatch[1]) : 0;

    const timesMatch = html.match(/剩余挑战次数[：:]\s*(\d+)/);
    const times = timesMatch ? parseInt(timesMatch[1]) : 0;

    const nameMatch = html.match(/【([^】]+)】/);
    const name = nameMatch ? nameMatch[1] : '';

    const canFight = html.includes('op=monsterfight') || html.includes('op=saodang');

    return { name, hp, times, canFight };
  }

  parseMonsterList(html) {
    if (!html) return [];
    const monsters = [];
    for (const monster of MONSTERS) {
      if (html.includes(`monsterdetail&amp;id=${monster.id}`) || html.includes(`monsterdetail&id=${monster.id}`)) {
        monsters.push(monster);
      }
    }
    return monsters;
  }

  async getMonsterDetail(monsterId) {
    const html = await this.request('spacerelic', { op: 'monsterdetail', id: String(monsterId) });
    return this.parseMonsterDetail(html);
  }

  async fightMonster(monsterId) {
    const html = await this.request('spacerelic', { op: 'monsterfight', id: String(monsterId) });
    return this.parseMonsterResult(html);
  }

  async runMonster() {
    const results = [];

    for (const monster of MONSTERS) {
      try {
        const detail = await this.getMonsterDetail(monster.id);
        
        if (!detail) {
          results.push({ name: monster.name, success: false, message: '获取信息失败' });
          continue;
        }

        if (detail.times <= 0) {
          results.push({ name: monster.name, success: true, message: '无挑战次数', skipped: true });
          continue;
        }

        if (detail.hp <= 0) {
          results.push({ name: monster.name, success: true, message: '已击败', skipped: true });
          continue;
        }

        const result = await this.fightMonster(monster.id);

        results.push({
          name: monster.name,
          hp: detail.hp,
          times: detail.times,
          ...result,
        });

        await this.delay(500);

        return {
          success: true,
          message: `已挑战${monster.name}`,
          monsters: results,
        };
      } catch (error) {
        results.push({ name: monster.name, success: false, message: error.message });
      }
    }

    return {
      success: true,
      message: '无可挑战异兽',
      monsters: results,
    };
  }

  async runGoosip() {
    const html = await this.request('spacerelic', { op: 'goosip' });
    return this.parseGoosipResult(html);
  }

  parseMaptreasureInfo(html) {
    if (!html) return { maps: 0, blessing: 0 };

    const mapsMatch = html.match(/舆图[：:]\s*(\d+)/);
    const maps = mapsMatch ? parseInt(mapsMatch[1]) : 0;

    const blessingMatch = html.match(/探宝祝福[：:]\s*(\d+)\s*\/\s*(\d+)/);
    const blessing = blessingMatch ? { current: parseInt(blessingMatch[1]), max: parseInt(blessingMatch[2]) } : { current: 0, max: 0 };

    return { maps, blessing };
  }

  parseTreasureResult(html) {
    if (!html) return { success: false, message: '无响应' };

    if (html.includes('获得') || html.includes('恭喜') || html.includes('成功')) {
      const text = this.extractText(html);
      const itemMatch = text.match(/获得([^，。\n]+)/);
      return { success: true, message: itemMatch ? `获得${itemMatch[1].trim()}` : '探宝成功' };
    }

    if (html.includes('舆图不足') || html.includes('没有舆图')) {
      return { success: false, message: '舆图不足' };
    }

    return { success: false, message: '探宝失败' };
  }

  async doTreasure(num = 1) {
    const html = await this.request('spacerelic', { op: 'treasure', num: String(num) });
    return this.parseTreasureResult(html);
  }

  async runMaptreasure() {
    const html = await this.request('spacerelic', { op: 'maptreasure' });
    const info = this.parseMaptreasureInfo(html);

    if (info.maps <= 0) {
      return { success: true, message: '无舆图可使用', maps: 0 };
    }

    const results = [];
    let remaining = info.maps;

    while (remaining >= 10) {
      const result = await this.doTreasure(10);
      results.push({ num: 10, ...result });
      remaining -= 10;
      await this.delay(500);
    }

    while (remaining >= 1) {
      const result = await this.doTreasure(1);
      results.push({ num: 1, ...result });
      remaining -= 1;
      await this.delay(500);
    }

    const success = results.filter(r => r.success);
    return {
      success: true,
      message: `使用${info.maps}张舆图，成功${success.length}次`,
      maps: info.maps,
      results,
    };
  }

  async runWashing(type = 1, id = 1) {
    const html = await this.request('spacerelic', { op: 'viewwashingindex', type: String(type), id: String(id) });
    return this.parseWashingResult(html);
  }

  async runUnion() {
    const html = await this.request('spacerelic', { op: 'bossfight' });
    return this.parseUnionResult(html);
  }

  parseTaskList(html, type) {
    if (!html) return { tasks: [], type };

    const tasks = [];

    const taskRegex = /([^<>\n]+?)\s*\((\d+)\/(\d+)\)[^<]*?(\d+)[^<]*?(已领取|<a[^>]*href="[^"]*&amp;id=(\d+)"[^>]*>领取<\/a>)/g;
    let match;

    while ((match = taskRegex.exec(html)) !== null) {
      const name = match[1].replace(/&nbsp;/g, '').trim();
      const current = parseInt(match[2]);
      const total = parseInt(match[3]);
      const reward = parseInt(match[4]);
      const status = match[5];
      const taskId = match[6];

      tasks.push({
        name,
        current,
        total,
        reward,
        completed: current >= total,
        claimed: status === '已领取',
        taskId: taskId ? parseInt(taskId) : null,
        type,
      });
    }

    return { tasks, type };
  }

  async claimTaskReward(type, taskId) {
    const html = await this.request('spacerelic', { op: 'task', type: String(type), id: String(taskId) });
    
    if (html.includes('成功') || html.includes('获得') || html.includes('恭喜')) {
      const text = this.extractText(html);
      const rewardMatch = text.match(/(\d+)/);
      return { success: true, message: rewardMatch ? `领取${rewardMatch[1]}积分` : '领取成功' };
    }

    if (html.includes('已领取')) {
      return { success: true, message: '已领取' };
    }

    return { success: false, message: '领取失败' };
  }

  async runTask(type = 1) {
    const html = await this.request('spacerelic', { op: 'task', type: String(type) });
    const taskList = this.parseTaskList(html, type);

    const claimableTasks = taskList.tasks.filter(t => t.completed && !t.claimed && t.taskId);

    if (claimableTasks.length === 0) {
      return { success: true, message: '无可领取任务', tasks: taskList.tasks };
    }

    const results = [];
    for (const task of claimableTasks) {
      const result = await this.claimTaskReward(type, task.taskId);
      results.push({
        name: task.name,
        reward: task.reward,
        ...result,
      });
      await this.delay(500);
    }

    const claimed = results.filter(r => r.success);
    return {
      success: true,
      message: `领取${claimed.length}个任务奖励`,
      tasks: taskList.tasks,
      claimed: results,
    };
  }

  async runAllTasks() {
    const allResults = [];

    const weeklyHtml = await this.request('spacerelic', { op: 'task', type: '1' });
    const weeklyTasks = this.parseTaskList(weeklyHtml, 1);
    allResults.push({ type: '每周任务', tasks: weeklyTasks.tasks });

    await this.delay(500);

    const seasonHtml = await this.request('spacerelic', { op: 'task', type: '2' });
    const seasonTasks = this.parseTaskList(seasonHtml, 2);
    allResults.push({ type: '赛季任务', tasks: seasonTasks.tasks });

    const allClaimable = [
      ...weeklyTasks.tasks.filter(t => t.completed && !t.claimed && t.taskId),
      ...seasonTasks.tasks.filter(t => t.completed && !t.claimed && t.taskId),
    ];

    const claimedResults = [];
    for (const task of allClaimable) {
      const result = await this.claimTaskReward(task.type, task.taskId);
      claimedResults.push({
        type: task.type === 1 ? '每周' : '赛季',
        name: task.name,
        reward: task.reward,
        ...result,
      });
      await this.delay(500);
    }

    return {
      success: true,
      message: `领取${claimedResults.length}个任务奖励`,
      taskLists: allResults,
      claimed: claimedResults,
    };
  }

  parseShopItems(html) {
    if (!html) return { points: 0, items: [] };

    const pointsMatch = html.match(/我的积分[:：]\s*(\d+)/);
    const points = pointsMatch ? parseInt(pointsMatch[1]) : 0;

    const items = [];
    const itemRegex = /([^<>\n]+?)\s*消耗积分[:：]\s*(\d+)[^<]*限购数量[:：]\s*(\d+)\/(\d+)/gi;
    let match;

    while ((match = itemRegex.exec(html)) !== null) {
      const name = match[1].replace(/&nbsp;/g, '').trim();
      const cost = parseInt(match[2]);
      const remaining = parseInt(match[3]);
      const limit = parseInt(match[4]);

      const linkMatch = html.substring(match.index).match(/<a[^>]*href="[^"]*op=buy(?:&amp;|&)type=(\d+)(?:&amp;|&)id=(\d+)(?:&amp;|&)num=1"/);
      if (!linkMatch) continue;

      const type = parseInt(linkMatch[1]);
      const id = parseInt(linkMatch[2]);

      if (name && cost && limit > 0 && remaining > 0) {
        items.push({ name, cost, remaining, limit, type, id });
      }
    }

    return { points, items };
  }

  async buyItem(type, id, num = 1) {
    const html = await this.request('spacerelic', { op: 'buy', type: String(type), id: String(id), num: String(num) });
    
    console.log(`[兑换] type=${type}, id=${id}, num=${num}`);
    console.log(`[兑换响应] ${html.substring(0, 200).replace(/\n/g, ' ')}`);

    if (html.includes('成功') || html.includes('获得') || html.includes('恭喜')) {
      return { success: true, message: '兑换成功' };
    }

    if (html.includes('积分不足')) {
      return { success: false, message: '积分不足' };
    }

    if (html.includes('已售罄') || html.includes('限购')) {
      return { success: false, message: '已售罄或限购' };
    }

    return { success: true, message: '已执行兑换' };
  }

  async runShop() {
    const results = [];
    let totalBought = 0;

    let html = await this.request('spacerelic', { op: 'shopping', type: '1' });
    let shop = this.parseShopItems(html);
    let currentPoints = shop.points;

    console.log(`[遗迹商店] 特惠区积分: ${currentPoints}, 可购商品: ${shop.items.length}`);
    shop.items.forEach(i => console.log(`  - ${i.name}: 积分${i.cost}, 剩余${i.remaining}/${i.limit}`));

    const sortedItems1 = shop.items.sort((a, b) => {
      if (a.name.includes('舆图') && !b.name.includes('舆图')) return -1;
      if (!a.name.includes('舆图') && b.name.includes('舆图')) return 1;
      return a.cost - b.cost;
    });

    for (const item of sortedItems1) {
      while (currentPoints >= item.cost && item.remaining > 0) {
        const result = await this.buyItem(item.type, item.id, 1);
        results.push({ name: item.name, count: 1, cost: item.cost, ...result });
        
        if (result.success) {
          currentPoints -= item.cost;
          item.remaining--;
          totalBought++;
        } else {
          break;
        }
        await this.delay(300);
      }
    }

    await this.delay(500);

    html = await this.request('spacerelic', { op: 'shopping', type: '2' });
    shop = this.parseShopItems(html);

    console.log(`[遗迹商店] 售卖区积分: ${currentPoints}, 可购商品: ${shop.items.length}`);
    shop.items.forEach(i => console.log(`  - ${i.name}: 积分${i.cost}, 剩余${i.remaining}/${i.limit}`));

    const sortedItems2 = shop.items.sort((a, b) => {
      if (a.name.includes('舆图') && !b.name.includes('舆图')) return -1;
      if (!a.name.includes('舆图') && b.name.includes('舆图')) return 1;
      return a.cost - b.cost;
    });

    for (const item of sortedItems2) {
      while (currentPoints >= item.cost && item.remaining > 0) {
        const result = await this.buyItem(item.type, item.id, 1);
        results.push({ name: item.name, count: 1, cost: item.cost, ...result });
        
        if (result.success) {
          currentPoints -= item.cost;
          item.remaining--;
          totalBought++;
        } else {
          break;
        }
        await this.delay(300);
      }
    }

    return {
      success: true,
      message: `兑换${totalBought}件商品，剩余${currentPoints}积分`,
      initialPoints: shop.points,
      remainingPoints: currentPoints,
      items: results,
    };
  }

  async run(params = {}) {
    const results = [];
    let successCount = 0;
    let failCount = 0;
    let hasEnergy = true;

    const tasks = [
      { name: '异兽洞窟', op: 'monster', enabled: params.monster !== false },
      { name: '联合征伐', op: 'union', enabled: params.union !== false },
      { name: '八卦迷阵', op: 'goosip', enabled: params.goosip !== false },
      { name: '舆图探宝', op: 'maptreasure', enabled: params.maptreasure !== false },
      { name: '天象洗髓', op: 'washing', enabled: params.washing !== false },
      { name: '悬赏任务', op: 'task', enabled: params.task !== false },
      { name: '遗迹商店', op: 'shop', enabled: params.shop !== false },
    ];

    for (const task of tasks) {
      if (!task.enabled || !hasEnergy) {
        results.push({ name: task.name, success: false, message: '已禁用或活力不足', skipped: true });
        continue;
      }

      try {
        let result;
        switch (task.op) {
          case 'goosip':
            result = await this.runGoosip();
            break;
          case 'maptreasure':
            result = await this.runMaptreasure();
            break;
          case 'washing':
            result = await this.runWashing(params.washingType || 1, params.washingId || 1);
            break;
          case 'monster':
            result = await this.runMonster();
            break;
          case 'union':
            result = await this.runUnion();
            break;
          case 'task':
            result = await this.runAllTasks();
            break;
          case 'shop':
            result = await this.runShop();
            break;
        }

        results.push({
          name: task.name,
          success: result.success,
          message: result.message,
          raw: result.raw || '',
        });

        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }

        if (result.noEnergy) {
          hasEnergy = false;
        }

        await this.delay(800);
      } catch (error) {
        results.push({
          name: task.name,
          success: false,
          message: error.message,
          raw: '',
        });
        failCount++;
      }
    }

    const summary = `时空遗迹：成功${successCount}个，失败${failCount}个`;
    const details = results.map(r => {
      let msg = `${r.name}: ${r.message}`;
      if (r.raw) msg += ` (${r.raw})`;
      return msg;
    }).join('\n');

    this.log(`${summary}\n${details}`, failCount === 0 ? 'success' : 'error');

    return this.success({
      result: summary,
      tasks: results,
      successCount,
      failCount,
    });
  }
}

module.exports = {
  SpaceRelicAction,
  action: new SpaceRelicAction(),
};