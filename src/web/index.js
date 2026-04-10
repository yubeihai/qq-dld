const express = require('express');
const path = require('path');
const { initDb, execLogs, cookieDb, moduleConfigs, taskTypes, taskConfigs, knightMissionTypes, knightMissionConfigs, badgeTypes, badgeConfigs, exchangeTypes, exchangeConfigs } = require('../db');
const { getAllActions, getAction } = require('../actions');
const { startScheduler, restartScheduler } = require('../scheduler');
const { login } = require('../game/login');
const { client } = require('../core/game-client');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', '..', 'public')));

app.get('/api/status', async (req, res) => {
  try {
    const valid = await client.checkLoginStatus();
    res.json({ loggedIn: valid });
  } catch (error) {
    res.json({ loggedIn: false });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    await login();
    client.clearCookie();
    res.json({ success: true });
  } catch (error) {
    res.json({ error: error.message });
  }
});

app.post('/api/logout', (req, res) => {
  cookieDb.clear();
  client.clearCookie();
  res.json({ success: true });
});

app.get('/api/modules', (req, res) => {
  const actions = getAllActions();
  const configs = moduleConfigs.getAll();
  const configMap = new Map(configs.map(c => [c.id, c]));
  
  const modules = actions.map(action => {
    const config = configMap.get(action.id) || {};
    let extraData = {};
    try {
      extraData = config.extra_data ? JSON.parse(config.extra_data) : {};
    } catch (e) {}
    return {
      ...action,
      auto_enabled: config.auto_enabled || 0,
      auto_time: config.auto_time || '',
      extra_data: extraData,
    };
  });
  
  res.json(modules);
});

app.post('/api/modules/reset', (req, res) => {
  moduleConfigs.reset();
  res.json({ success: true });
});

app.get('/api/modules/:id/logs', (req, res) => {
  const { id } = req.params;
  const { limit } = req.query;
  
  const action = getAction(id);
  if (!action) {
    return res.json({ error: '模块不存在' });
  }
  
  const logs = execLogs.getByModuleId(id, parseInt(limit) || 20);
  res.json(logs);
});

app.get('/api/modules/:id', (req, res) => {
  const { id } = req.params;
  const action = getAction(id);
  
  if (!action) {
    return res.json({ error: '模块不存在' });
  }
  
  const config = moduleConfigs.getById(id) || {};
  let extraData = {};
  try {
    extraData = config.extra_data ? JSON.parse(config.extra_data) : {};
  } catch (e) {}
  
  res.json({
    ...action,
    auto_enabled: config.auto_enabled || 0,
    auto_time: config.auto_time || '',
    extra_data: extraData,
  });
});

app.post('/api/modules/:id', (req, res) => {
  const { id } = req.params;
  const action = getAction(id);
  
  if (!action) {
    return res.json({ error: '模块不存在' });
  }
  
  moduleConfigs.upsert(id, action.name, action.category, action.description);
  moduleConfigs.update(id, req.body);
  
  restartScheduler();
  
  res.json({ success: true });
});

app.post('/api/run/:id', async (req, res) => {
  try {
    const valid = await client.checkLoginStatus();
    if (!valid) {
      return res.json({ error: '登录已过期，请重新扫码登录' });
    }
    
    const action = getAction(req.params.id);
    if (!action) {
      return res.json({ error: '模块不存在' });
    }
    
    const params = { ...req.query, ...req.body };
    const result = await action.run(params);
    res.json(result);
  } catch (error) {
    res.json({ error: error.message });
  }
});

app.get('/api/logs', (req, res) => {
  const { date } = req.query;
  let logs;
  if (date) {
    logs = execLogs.getByDate(date);
  } else {
    const today = new Date().toISOString().split('T')[0];
    logs = execLogs.getByDate(today);
  }
  res.json(logs);
});

app.delete('/api/logs', (req, res) => {
  execLogs.clear();
  res.json({ success: true });
});

app.get('/api/xia-friends', (req, res) => {
  const { action } = require('../actions/friend-fight');
  const friends = action.getSavedFriends();
  res.json(friends);
});

app.post('/api/scan-xia-friends', async (req, res) => {
  try {
    const { action } = require('../actions/friend-fight');
    const friends = await action.scanFriends();
    action.saveFriends(friends);
    res.json({ success: true, count: friends.length, friends });
  } catch (error) {
    res.json({ error: error.message });
  }
});

app.post('/api/xia-friends', (req, res) => {
  const { friends } = req.body;
  const { action } = require('../actions/friend-fight');
  action.saveFriends(friends);
  res.json({ success: true });
});

app.get('/api/formation-types', (req, res) => {
  const { FORMATION_TYPES, DEFAULT_FORMATIONS } = require('../actions/formation');
  res.json({ types: FORMATION_TYPES, formations: DEFAULT_FORMATIONS });
});

app.get('/api/formation-scan', async (req, res) => {
  try {
    const valid = await client.checkLoginStatus();
    if (!valid) {
      return res.json({ error: '登录已过期，请重新扫码登录' });
    }
    
    const { action } = require('../actions/formation');
    const result = await action.run({ action: 'scan' });
    res.json(result);
  } catch (error) {
    res.json({ error: error.message });
  }
});

app.get('/api/task-types', (req, res) => {
  const types = taskTypes.getAll();
  res.json(types);
});

app.get('/api/task-configs', (req, res) => {
  const configs = taskConfigs.getAll();
  res.json(configs);
});

app.post('/api/task-configs', (req, res) => {
  const { configs } = req.body;
  if (!Array.isArray(configs)) {
    return res.json({ error: '配置格式错误' });
  }
  taskConfigs.upsertBatch(configs);
  res.json({ success: true });
});

app.post('/api/task-configs/:id', (req, res) => {
  const { id } = req.params;
  const { actionType, actionModule } = req.body;
  
  if (!['module', 'replace', 'skip'].includes(actionType)) {
    return res.json({ error: '无效的操作类型' });
  }
  
  taskConfigs.upsert(id, actionType, actionModule || '');
  res.json({ success: true });
});

app.delete('/api/task-configs/:id', (req, res) => {
  const { id } = req.params;
  taskConfigs.delete(id);
  res.json({ success: true });
});

app.get('/api/task-list', async (req, res) => {
  try {
    const valid = await client.checkLoginStatus();
    if (!valid) {
      return res.json({ error: '登录已过期，请重新扫码登录' });
    }
    
    const { action } = require('../actions/task');
    const { tasks } = await action.getTaskList();
    
    if (tasks.length > 0) {
      taskTypes.upsertBatch(tasks.map(t => ({ id: t.id, name: t.name })));
    }
    
    const allTypes = taskTypes.getAll();
    const configs = taskConfigs.getAll();
    
    res.json({
      todayTasks: tasks,
      allTypes,
      configs,
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

app.get('/api/knight-mission-types', (req, res) => {
  const types = knightMissionTypes.getAll();
  res.json(types);
});

app.get('/api/knight-mission-configs', (req, res) => {
  const configs = knightMissionConfigs.getAll();
  res.json(configs);
});

app.post('/api/knight-mission-configs', (req, res) => {
  const { configs } = req.body;
  if (!Array.isArray(configs)) {
    return res.json({ error: '配置格式错误' });
  }
  knightMissionConfigs.upsertBatch(configs);
  res.json({ success: true });
});

app.post('/api/knight-mission-configs/:name', (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const { enabled } = req.body;
    knightMissionConfigs.upsert(name, enabled !== false);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/knight-mission-configs/:name', (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    knightMissionConfigs.delete(name);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/knight-mission-list', async (req, res) => {
  try {
    const valid = await client.checkLoginStatus();
    if (!valid) {
      return res.json({ error: '登录已过期，请重新扫码登录' });
    }
    
    const { action } = require('../actions/knight-island');
    const missionIndex = await action.getMissionIndex();
    
    if (missionIndex.success && missionIndex.missions.length > 0) {
      action.saveMissionTypes(missionIndex.missions);
    }
    
    const allTypes = knightMissionTypes.getAll();
    const configs = knightMissionConfigs.getAll();
    
    res.json({
      todayMissions: missionIndex.missions || [],
      accepted: missionIndex.accepted || { current: 0, max: 3 },
      refreshCount: missionIndex.refreshCount || { current: 4, max: 4 },
      allTypes,
      configs,
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// 徽章类型列表
app.get('/api/badge-types', (req, res) => {
  const types = badgeTypes.getAll();
  res.json(types);
});

// 徽章配置列表
app.get('/api/badge-configs', (req, res) => {
  const configs = badgeConfigs.getAll();
  res.json(configs);
});

// 批量更新徽章配置
app.post('/api/badge-configs', (req, res) => {
  const { configs } = req.body;
  if (!Array.isArray(configs)) {
    return res.json({ error: '配置格式错误' });
  }
  badgeConfigs.upsertBatch(configs);
  res.json({ success: true });
});

// 单个徽章配置
app.post('/api/badge-configs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    badgeConfigs.upsert(id, enabled !== false);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除徽章配置
app.delete('/api/badge-configs/:id', (req, res) => {
  try {
    const { id } = req.params;
    badgeConfigs.delete(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 扫描徽章列表并保存
app.get('/api/badge-list', async (req, res) => {
  try {
    const valid = await client.checkLoginStatus();
    if (!valid) {
      return res.json({ error: '登录已过期，请重新扫码登录' });
    }
    
    const { action: badgeHall } = require('../actions/badge-hall');
    
    // 扫描所有页面的徽章
    let allBadges = [];
    let page = 1;
    let totalPages = 1;
    
    do {
      const result = await badgeHall.run({ action: 'list', page });
      if (result.success && result.badges) {
        allBadges = allBadges.concat(result.badges);
        totalPages = result.totalPages || 1;
      }
      page++;
    } while (page <= totalPages);
    
    // 去重
    const uniqueBadges = [];
    const seen = new Set();
    for (const b of allBadges) {
      if (!seen.has(b.id)) {
        seen.add(b.id);
        uniqueBadges.push(b);
      }
    }
    
    // 保存到数据库
    if (uniqueBadges.length > 0) {
      badgeTypes.upsertBatch(uniqueBadges.map(b => ({
        id: b.id,
        name: b.name,
        rank: b.rank,
        stage: b.stage,
      })));
    }
    
    const allTypes = badgeTypes.getAll();
    const configs = badgeConfigs.getAll();
    
    res.json({
      badges: uniqueBadges,
      achievement: allBadges.length > 0 ? allBadges[0].achievement : 0,
      badgeCount: uniqueBadges.length,
      allTypes,
      configs,
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// 批量进阶勾选的徽章
app.post('/api/badge-upgrade-selected', async (req, res) => {
  try {
    const valid = await client.checkLoginStatus();
    if (!valid) {
      return res.json({ error: '登录已过期，请重新扫码登录' });
    }
    
    const enabledConfigs = badgeConfigs.getEnabled();
    if (enabledConfigs.length === 0) {
      return res.json({ error: '请先勾选要进阶的徽章' });
    }
    
    const { action: badgeHall } = require('../actions/badge-hall');
    const results = [];
    
    for (const config of enabledConfigs) {
      try {
        const result = await badgeHall.run({ 
          action: 'doupgrade', 
          achievementId: config.badge_id,
          times: 1 
        });
        results.push({
          id: config.badge_id,
          name: config.name,
          success: result.success,
          message: result.result || result.error || '',
        });
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (e) {
        results.push({
          id: config.badge_id,
          name: config.name,
          success: false,
          message: e.message,
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    res.json({
      success: true,
      total: results.length,
      successCount,
      results,
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// ========== 交换配置 API ==========

// 获取所有交换类型和配置
app.get('/api/exchange-configs', (req, res) => {
  const types = exchangeTypes.getAll();
  const configs = exchangeConfigs.getAll();
  res.json({ types, configs });
});

// 更新交换配置
app.post('/api/exchange-configs', (req, res) => {
  const { id, action } = req.body;
  
  if (!id) {
    return res.json({ error: '缺少交换ID' });
  }
  
  if (!['accept', 'reject'].includes(action)) {
    return res.json({ error: 'action 必须是 accept 或 reject' });
  }
  
  exchangeConfigs.upsert(id, action);
  res.json({ success: true, id, action });
});

// 批量更新交换配置
app.post('/api/exchange-configs/batch', (req, res) => {
  const { configs } = req.body;
  
  if (!Array.isArray(configs)) {
    return res.json({ error: 'configs 必须是数组' });
  }
  
  exchangeConfigs.upsertBatch(configs);
  res.json({ success: true, count: configs.length });
});

// 删除交换配置
app.delete('/api/exchange-configs/:id', (req, res) => {
  const { id } = req.params;
  exchangeConfigs.delete(id);
  res.json({ success: true });
});

// 清空所有交换配置
app.delete('/api/exchange-configs', (req, res) => {
  exchangeConfigs.clear();
  res.json({ success: true });
});

async function start() {
  console.log('正在初始化数据库...');
  await initDb();
  console.log('数据库初始化完成');
  
  app.listen(PORT, () => {
    console.log(`QQ 大乐斗助手已启动：http://localhost:${PORT}`);
    startScheduler();
  });
}

start().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});

module.exports = app;