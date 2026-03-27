const { ActionBase } = require('../core/action-base');
const { settings } = require('../db');

class StoreAction extends ActionBase {
  constructor() {
    super({
      id: 'store',
      name: '背包管理',
      description: '扫描背包物品、查看道具详情、设置供奉物品',
      category: '查询功能',
    });
  }

  getOblationConfig() {
    const config = settings.get('oblation_items', []);
    return Array.isArray(config) ? config : [];
  }

  setOblationConfig(itemIds) {
    settings.set('oblation_items', itemIds);
  }

  parseStorePage(html) {
    if (!html) return { items: [], tabs: [], totalPages: 1 };

    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      throw new Error('登录已过期，请重新扫码登录');
    }

    const items = [];
    const tabs = [];

    const tabRegex = /<a[^>]*href="[^"]*cmd=store[^"]*store_type=(\d+)[^"]*"[^>]*>([^<]+)<\/a>/gi;
    let tabMatch;
    while ((tabMatch = tabRegex.exec(html)) !== null) {
      tabs.push({
        id: tabMatch[1],
        name: tabMatch[2].trim(),
      });
    }

    const itemRegex = /<a[^>]*href="[^"]*cmd=owngoods[^"]*id=(\d+)[^"]*"[^>]*>([^<]+)<\/a>[\s]*数量[：:](\d+)/gi;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(html)) !== null) {
      items.push({
        id: itemMatch[1],
        name: itemMatch[2].trim().replace(/\s+/g, ' '),
        count: itemMatch[3],
        desc: '',
      });
    }

    if (items.length === 0) {
      const simpleRegex = /owngoods&amp;id=(\d+)[^>]*>([^<]+)<\/a>([^<]*)数量[：:](\d+)/gi;
      let simpleMatch;
      while ((simpleMatch = simpleRegex.exec(html)) !== null) {
        items.push({
          id: simpleMatch[1],
          name: simpleMatch[2].trim(),
          count: simpleMatch[4],
          desc: '',
        });
      }
    }

    const pageMatch = html.match(/第(\d+)\/(\d+)页/);
    const totalPages = pageMatch ? parseInt(pageMatch[2]) : 1;

    return { items, tabs, totalPages };
  }

  async scanStore(storeType = '0', page = 1) {
    const params = { store_type: storeType, page: page };
    const html = await this.request('store', params);
    return this.parseStorePage(html);
  }

  async run(params = {}) {
    const { type = null, action = 'scan', itemIds = [] } = params;

    if (action === 'setOblation') {
      const config = this.getOblationConfig();
      if (itemIds.length > 0) {
        const newConfig = [...new Set([...config, ...itemIds])];
        this.setOblationConfig(newConfig);
        this.log(`添加供奉物品: ${itemIds.join(', ')}`, 'success');
        return this.success({ message: '添加成功', oblationItems: newConfig });
      }
      this.log(`当前供奉配置: ${config.length > 0 ? config.join(', ') : '未配置'}`, 'success');
      return this.success({ oblationItems: config });
    }

    if (action === 'clearOblation') {
      this.setOblationConfig([]);
      this.log('已清空供奉配置', 'success');
      return this.success({ message: '已清空' });
    }

    if (action === 'removeOblation') {
      const config = this.getOblationConfig();
      const newConfig = config.filter(id => !itemIds.includes(id));
      this.setOblationConfig(newConfig);
      this.log(`移除供奉物品: ${itemIds.join(', ')}`, 'success');
      return this.success({ oblationItems: newConfig });
    }

    try {
      const html = await this.request('index', {});
      if (!html || html.includes('ptlogin2.qq.com')) {
        this.log('登录已过期，请重新扫码登录', 'error');
        return this.fail('登录已过期，请重新扫码登录');
      }
    } catch (error) {
      this.log('检查登录失败: ' + error.message, 'error');
      return this.fail(error.message);
    }

    let allItems = [];
    let tabs = [];
    const MAX_PAGES = 10;

    try {
      const typeNames = {'0': '全部', '1': '药水', '2': '属性', '3': '强化', '4': '魂珠', '5': '锦囊', '6': '星石', '7': '荣誉', '10': '其它'};
      const storeTypes = Object.keys(typeNames);
      
      tabs = storeTypes.map(t => ({ id: t, name: typeNames[t] || t }));

      const typesToScan = type ? [String(type)] : storeTypes.filter(t => t !== '0');

      for (const storeType of typesToScan) {
        let page = 1;
        let totalPages = 1;

        do {
          const result = await this.scanStore(storeType, page);
          if (result.items.length > 0) {
            allItems = allItems.concat(result.items);
          }
          totalPages = Math.min(result.totalPages || 1, MAX_PAGES);
          page++;
        } while (page <= totalPages);
      }

      const uniqueMap = new Map();
      allItems.forEach(item => {
        if (!uniqueMap.has(item.id)) {
          uniqueMap.set(item.id, item);
        }
      });
      allItems = Array.from(uniqueMap.values());

      const summary = `背包扫描完成：共${allItems.length}种物品`;
      this.log(summary, 'success');

      const oblationItems = this.getOblationConfig();
      const itemsWithOblation = allItems.map(item => ({
        ...item,
        isOblation: oblationItems.includes(item.id),
      }));

      return this.success({
        result: summary,
        items: itemsWithOblation,
        tabs: tabs,
        totalCount: allItems.length,
        oblationItems,
      });
    } catch (error) {
      this.log('扫描失败: ' + error.message, 'error');
      return this.fail(error.message);
    }
  }
}

module.exports = {
  StoreAction,
  action: new StoreAction(),
};
