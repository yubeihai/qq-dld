const express = require('express');
const { client } = require('../../core/game-client');
const { taskTypes, taskConfigs } = require('../../db');
const { taskEngine } = require('../../engine/task-engine');
const { asyncHandler } = require('../middleware/error-handler');

function createTaskRoutes() {
  const router = express.Router();

  router.get('/types', asyncHandler(async (req, res) => {
    const types = taskTypes.getAll();
    res.json(types);
  }));

  router.get('/configs', asyncHandler(async (req, res) => {
    const configs = taskConfigs.getAll();
    res.json(configs);
  }));

  router.post('/configs', asyncHandler(async (req, res) => {
    const { configs } = req.body;
    if (!Array.isArray(configs)) {
      return res.json({ error: '配置格式错误' });
    }
    taskConfigs.upsertBatch(configs);
    res.json({ success: true });
  }));

  router.post('/configs/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { actionType, actionModule } = req.body;

    if (!['module', 'replace', 'skip'].includes(actionType)) {
      return res.json({ error: '无效的操作类型' });
    }

    taskConfigs.upsert(id, actionType, actionModule || '');
    res.json({ success: true });
  }));

  router.delete('/configs/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    taskConfigs.delete(id);
    res.json({ success: true });
  }));

  router.get('/list', asyncHandler(async (req, res) => {
    const valid = await client.checkLoginStatus();
    if (!valid) {
      return res.json({ error: '登录已过期，请重新扫码登录' });
    }

    const { tasks } = await taskEngine.getTaskList();

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
  }));

  router.post('/execute', asyncHandler(async (req, res) => {
    const valid = await client.checkLoginStatus();
    if (!valid) {
      return res.json({ error: '登录已过期，请重新扫码登录' });
    }

    const { tasks, source = 'manual', maxReplaces = 3 } = req.body;

    if (!tasks || !Array.isArray(tasks)) {
      const { tasks: fetchedTasks } = await taskEngine.getTaskList();
      const result = await taskEngine.executeAll(fetchedTasks, { source, maxReplaces });
      return res.json(result);
    }

    const result = await taskEngine.executeAll(tasks, { source, maxReplaces });
    res.json(result);
  }));

  return router;
}

module.exports = { createTaskRoutes };
