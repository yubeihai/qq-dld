const { ActionBase } = require('../core/action-base');
const { SessionLogger } = require('../core/session-logger');
const { ErrorHandler } = require('../core/error-handler');
const { settings } = require('../db');

class StoreAction extends ActionBase {
  constructor() {
    super({
      id: 'store',
      name: '背包管理',
      description: '扫描背包物品、查看道具详情、设置供奉物品',
      category: '查询功能',
    });

    this.typeNames = {
      '0': '全部',
      '1': '药水',
      '2': '属性',
      '3': '强化',
      '4': '魂珠',
      '5': '锦囊',
      '6': '星石',
      '7': '荣誉',
      '10': '其它',
    };
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
    const logger = this.createLogger(params.source || 'manual');
    logger.start({ action, type, itemIds });

    if (action === 'setOblation') {
      const config = this.getOblationConfig();
      if (itemIds.length > 0) {
        const newConfig = [...new Set([...config, ...itemIds])];
        this.setOblationConfig(newConfig);
        logger.step('config', '设置供奉物品', 'success', { itemIds, newConfig }, '', Date.now());
        logger.end('success', { oblationItems: newConfig });
        return this.success({ message: '添加成功', oblationItems: newConfig });
      }
      logger.step('config', '查询供奉配置', 'success', { oblationItems: config }, '', Date.now());
      logger.end('success', { oblationItems: config });
      return this.success({ oblationItems: config });
    }

    if (action === 'clearOblation') {
      this.setOblationConfig([]);
      logger.step('config', '清空供奉配置', 'success', {}, '', Date.now());
      logger.end('success', { message: '已清空' });
      return this.success({ message: '已清空' });
    }

    if (action === 'removeOblation') {
      const config = this.getOblationConfig();
      const newConfig = config.filter(id => !itemIds.includes(id));
      this.setOblationConfig(newConfig);
      logger.step('config', '移除供奉物品', 'success', { itemIds }, '', Date.now());
      logger.end('success', { oblationItems: newConfig });
      return this.success({ oblationItems: newConfig });
    }

    let allItems = [];
    let tabs = [];
    let totalScanned = 0;
    const MAX_PAGES = 10;

    try {
      const loginStart = Date.now();
      const html = await this.request('index', {});
      const loginElapsed = Date.now() - loginStart;

      if (!html || html.includes('ptlogin2.qq.com')) {
        logger.step('check', '登录状态', 'failed', {}, '登录已过期', loginElapsed);
        return this.handleError(ErrorHandler.loginExpired());
      }

      logger.step('check', '登录状态', 'success', {}, '', loginElapsed);
    } catch (error) {
      logger.step('check', '登录状态', 'failed', {}, error.message, Date.now());
      return this.handleError(error);
    }

    try {
      const storeTypes = Object.keys(this.typeNames);
      tabs = storeTypes.map(t => ({ id: t, name: this.typeNames[t] || t }));
      const typesToScan = type ? [String(type)] : storeTypes.filter(t => t !== '0');

      for (const storeType of typesToScan) {
        const typeStart = Date.now();
        let page = 1;
        let totalPages = 1;
        let typeItemCount = 0;

        do {
          const scanStart = Date.now();
          const result = await this.scanStore(storeType, page);
          const elapsed = Date.now() - scanStart;

          if (result.items.length > 0) {
            allItems = allItems.concat(result.items);
            typeItemCount += result.items.length;
          }

          logger.step('scan', `${this.typeNames[storeType]} 第${page}页`, 'success',
            { itemCount: result.items.length }, '', elapsed);

          totalPages = Math.min(result.totalPages || 1, MAX_PAGES);
          totalScanned++;
          page++;
        } while (page <= totalPages);

        logger.step('scan', `${this.typeNames[storeType]} 分类`, 'success',
          { totalCount: typeItemCount }, '', Date.now() - typeStart);
      }

      const uniqueMap = new Map();
      allItems.forEach(item => {
        if (!uniqueMap.has(item.id)) {
          uniqueMap.set(item.id, item);
        }
      });
      allItems = Array.from(uniqueMap.values());

      const oblationItems = this.getOblationConfig();
      const itemsWithOblation = allItems.map(item => ({
        ...item,
        isOblation: oblationItems.includes(item.id),
      }));

      const summary = `背包扫描完成：共${allItems.length}种物品`;
      logger.step('scan', '去重合并', 'success', { uniqueCount: allItems.length }, '', Date.now());
      logger.end('success', {
        totalCount: allItems.length,
        scannedPages: totalScanned,
        oblationItems,
      });

      return this.success({
        result: summary,
        items: itemsWithOblation,
        tabs,
        totalCount: allItems.length,
        oblationItems,
        sessionId: logger.sessionId,
      });
    } catch (error) {
      logger.step('scan', '扫描失败', 'failed', {}, error.message, Date.now());
      logger.end('failed', { error: error.message });
      return this.handleError(error);
    }
  }
}

module.exports = {
  StoreAction,
  action: new StoreAction(),
};
