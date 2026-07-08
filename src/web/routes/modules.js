const express = require('express');
const { getAllActions, getAction, registry } = require('../../actions');
const { moduleConfigs } = require('../../db');
const { restartScheduler } = require('../../scheduler');
const { asyncHandler } = require('../middleware/error-handler');

function createModuleRoutes() {
  const router = express.Router();

  router.get('/', asyncHandler(async (req, res) => {
    const actions = getAllActions();
    const configs = moduleConfigs.getAll();
    const configMap = new Map(configs.map(c => [c.id, c]));

    const modules = actions.map(action => {
      const config = configMap.get(action.id) || {};
      let extraData = {};
      try {
        extraData = config.extra_data ? JSON.parse(config.extra_data) : {};
      } catch { }
      return {
        ...action,
        auto_enabled: config.auto_enabled || 0,
        auto_time: config.auto_time || '',
        extra_data: extraData,
      };
    });

    res.json(modules);
  }));

  router.post('/reset', asyncHandler(async (req, res) => {
    moduleConfigs.reset();
    res.json({ success: true });
  }));

  router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const action = getAction(id);

    if (!action) {
      return res.json({ error: '模块不存在' });
    }

    const config = moduleConfigs.getById(id) || {};
    let extraData = {};
    try {
      extraData = config.extra_data ? JSON.parse(config.extra_data) : {};
    } catch { }

    res.json({
      ...action,
      auto_enabled: config.auto_enabled || 0,
      auto_time: config.auto_time || '',
      extra_data: extraData,
    });
  }));

  router.post('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const action = getAction(id);

    if (!action) {
      return res.json({ error: '模块不存在' });
    }

    moduleConfigs.upsert(id, action.name, action.category, action.description);
    moduleConfigs.update(id, req.body);

    restartScheduler();

    res.json({ success: true });
  }));

  router.get('/:id/logs', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { limit } = req.query;

    const action = getAction(id);
    if (!action) {
      return res.json({ error: '模块不存在' });
    }

    const execLogs = require('../../db').execLogs;
    const logs = execLogs.getByModuleId(id, parseInt(limit) || 20);
    res.json(logs);
  }));

  return router;
}

module.exports = { createModuleRoutes };
