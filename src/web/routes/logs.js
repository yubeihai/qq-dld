const express = require('express');
const { execLogs, logSessions, logSteps, logRequests } = require('../../db');
const { asyncHandler } = require('../middleware/error-handler');

function createLogRoutes() {
  const router = express.Router();

  router.get('/', asyncHandler(async (req, res) => {
    const { date } = req.query;
    let logs;
    if (date) {
      logs = execLogs.getByDate(date);
    } else {
      const today = new Date().toISOString().split('T')[0];
      logs = execLogs.getByDate(today);
    }
    res.json(logs);
  }));

  router.delete('/', asyncHandler(async (req, res) => {
    execLogs.clear();
    res.json({ success: true });
  }));

  router.get('/sessions', asyncHandler(async (req, res) => {
    const { module_id, status, date, source, page = 1, limit = 50 } = req.query;

    const filters = {};
    if (module_id) filters.module_id = module_id;
    if (status) filters.status = status;
    if (date) filters.date = date;
    if (source) filters.source = source;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const sessions = logSessions.findAll(filters, 'created_at DESC', parseInt(limit), offset);
    const total = logSessions.count(filters);

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      sessions,
    });
  }));

  router.get('/sessions/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const session = logSessions.findById(id);

    if (!session) {
      return res.json({ error: '会话不存在' });
    }

    try {
      session.summary = JSON.parse(session.summary || '{}');
    } catch {
      session.summary = {};
    }

    const steps = logSteps.findBySession(id);
    const requests = logRequests.findBySession(id);

    res.json({ ...session, steps, requests });
  }));

  router.get('/sessions/:id/requests', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const requests = logRequests.findBySession(id);
    res.json(requests);
  }));

  router.get('/stats', asyncHandler(async (req, res) => {
    const { date } = req.query;
    const stats = logSessions.getStats(date);
    res.json(stats);
  }));

  router.post('/cleanup', asyncHandler(async (req, res) => {
    const { requestDays = 7, stepDays = 30, sessionDays = 90 } = req.body;
    logRequests.clearOld(requestDays);
    logSteps.clearOld(stepDays);
    logSessions.clearOld(sessionDays);
    res.json({ success: true, message: '日志清理完成' });
  }));

  return router;
}

module.exports = { createLogRoutes };
