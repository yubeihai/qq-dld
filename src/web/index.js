const express = require('express');
const path = require('path');
const { initDb, execLogs, cookieDb, moduleConfigs, taskTypes, taskConfigs, knightMissionTypes, knightMissionConfigs } = require('../db');
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