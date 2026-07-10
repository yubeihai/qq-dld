const express = require('express');
const path = require('path');
const { createAuthRoutes } = require('./routes/auth');
const { createModuleRoutes } = require('./routes/modules');
const { createLogRoutes } = require('./routes/logs');
const { createTaskRoutes } = require('./routes/tasks');
const { createFriendRoutes } = require('./routes/friends');
const { createSchedulerRoutes } = require('./routes/scheduler');
const { errorHandler, notFoundHandler, asyncHandler } = require('./middleware/error-handler');
const { client } = require('../core/game-client');
const { startLogin, checkLoginSession, clearSession } = require('../game/login');
const { cookieDb, execLogs, moduleConfigs, friends, taskTypes, taskConfigs, knightMissionTypes, knightMissionConfigs } = require('../db');
const { getAction } = require('../actions');
const { restartScheduler } = require('../scheduler');

function createApp() {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', '..', 'public')));

  app.get('/api/status', asyncHandler(async (req, res) => {
    const sessionResult = await checkLoginSession();
    if (sessionResult && sessionResult.status === 'success') {
      res.json({ loggedIn: true });
      return;
    }
    const valid = await client.checkLoginStatus();
    res.json({ loggedIn: valid });
  }));

  app.post('/api/login', asyncHandler(async (req, res) => {
    const result = await startLogin();
    if (result.qrCode) {
      res.json({ success: true, qrCode: result.qrCode });
    } else {
      res.json({ success: false, error: '无法获取二维码' });
    }
  }));

  app.post('/api/logout', asyncHandler(async (req, res) => {
    cookieDb.clear();
    client.clearCookie();
    clearSession();
    res.json({ success: true });
  }));

  app.post('/api/run/:id', asyncHandler(async (req, res) => {
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
  }));

  app.get('/api/xia-friends', asyncHandler(async (req, res) => {
    const list = friends.getAll();
    res.json(list);
  }));

  app.post('/api/xia-friends', asyncHandler(async (req, res) => {
    const { friends: friendsList } = req.body;
    if (Array.isArray(friendsList)) {
      friends.upsertBatch(friendsList);
    }
    res.json({ success: true });
  }));

  app.post('/api/scan-xia-friends', asyncHandler(async (req, res) => {
    const { action } = require('../actions/friend-fight');
    const scanned = await action.scanFriends();
    action.saveFriends(scanned);
    res.json({ success: true, count: scanned.length, friends: scanned });
  }));

  app.get('/api/task-types', (req, res) => res.json(taskTypes.getAll()));
  app.get('/api/task-configs', (req, res) => res.json(taskConfigs.getAll()));
  app.post('/api/task-configs', asyncHandler(async (req, res) => {
    const { configs: cfgs } = req.body;
    if (Array.isArray(cfgs)) taskConfigs.upsertBatch(cfgs);
    res.json({ success: true });
  }));
  app.post('/api/task-configs/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { actionType, actionModule } = req.body;
    taskConfigs.upsert(id, actionType || 'skip', actionModule || '');
    res.json({ success: true });
  }));
  app.delete('/api/task-configs/:id', asyncHandler(async (req, res) => {
    taskConfigs.delete(req.params.id);
    res.json({ success: true });
  }));

  app.get('/api/knight-mission-types', (req, res) => res.json(knightMissionTypes.getAll()));
  app.get('/api/knight-mission-configs', (req, res) => res.json(knightMissionConfigs.getAll()));
  app.post('/api/knight-mission-configs', asyncHandler(async (req, res) => {
    const { configs: cfgs } = req.body;
    if (Array.isArray(cfgs)) knightMissionConfigs.upsertBatch(cfgs);
    res.json({ success: true });
  }));
  app.post('/api/knight-mission-configs/:name', asyncHandler(async (req, res) => {
    const name = decodeURIComponent(req.params.name);
    const { enabled } = req.body;
    knightMissionConfigs.upsert(name, enabled !== false);
    res.json({ success: true });
  }));
  app.delete('/api/knight-mission-configs/:name', asyncHandler(async (req, res) => {
    knightMissionConfigs.delete(decodeURIComponent(req.params.name));
    res.json({ success: true });
  }));

  app.get('/api/task-list', asyncHandler(async (req, res) => {
    const { taskEngine } = require('../engine/task-engine');
    const valid = await client.checkLoginStatus();
    if (!valid) return res.json({ error: '登录已过期' });
    const { tasks } = await taskEngine.getTaskList();
    if (tasks && tasks.length > 0) taskTypes.upsertBatch(tasks.map(t => ({ id: t.id, name: t.name })));
    const allTypes = taskTypes.getAll();
    const configs = taskConfigs.getAll();
    res.json({ todayTasks: tasks || [], allTypes, configs });
  }));

  app.get('/api/knight-mission-list', asyncHandler(async (req, res) => {
    const { action } = require('../actions/knight-island');
    const valid = await client.checkLoginStatus();
    if (!valid) return res.json({ error: '登录已过期' });
    const missionIndex = await action.getMissionIndex();
    if (missionIndex.success && missionIndex.missions && missionIndex.missions.length > 0) {
      action.saveMissionTypes(missionIndex.missions);
    }
    const allTypes = knightMissionTypes.getAll();
    const configs = knightMissionConfigs.getAll();
    res.json({
      todayMissions: missionIndex.missions || [],
      accepted: missionIndex.accepted || { current: 0, max: 3 },
      refreshCount: missionIndex.refreshCount || { current: 4, max: 4 },
      allTypes, configs,
    });
  }));

  app.get('/api/formation-types', (req, res) => {
    const { FORMATION_TYPES, DEFAULT_FORMATIONS } = require('../actions/formation');
    res.json({ types: FORMATION_TYPES, formations: DEFAULT_FORMATIONS });
  });

  app.get('/api/formation-scan', asyncHandler(async (req, res) => {
    const { action } = require('../actions/formation');
    const result = await action.run({ action: 'scan' });
    res.json(result);
  }));

  app.use('/api/auth', createAuthRoutes());
  app.use('/api/accounts', createAuthRoutes());
  app.use('/api/modules', createModuleRoutes());
  app.use('/api/logs', createLogRoutes());
  app.use('/api/tasks', createTaskRoutes());
  app.use('/api/friends', createFriendRoutes());
  app.use('/api/scheduler', createSchedulerRoutes());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
