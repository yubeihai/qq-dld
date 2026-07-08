const express = require('express');
const {
  startScheduler,
  stopScheduler,
  restartScheduler,
  getSchedulerStatus,
  enqueueJob,
  getQueueStatus,
  getQueueJobs,
  clearQueue,
} = require('../../scheduler');
const { asyncHandler } = require('../middleware/error-handler');

function createSchedulerRoutes() {
  const router = express.Router();

  router.get('/status', asyncHandler(async (req, res) => {
    const status = getSchedulerStatus();
    res.json(status);
  }));

  router.post('/start', asyncHandler(async (req, res) => {
    startScheduler();
    res.json({ success: true, message: '调度器已启动' });
  }));

  router.post('/stop', asyncHandler(async (req, res) => {
    stopScheduler();
    res.json({ success: true, message: '调度器已停止' });
  }));

  router.post('/restart', asyncHandler(async (req, res) => {
    restartScheduler();
    res.json({ success: true, message: '调度器已重启' });
  }));

  router.get('/queue', asyncHandler(async (req, res) => {
    const status = getQueueStatus();
    res.json(status);
  }));

  router.get('/queue/jobs', asyncHandler(async (req, res) => {
    const jobs = getQueueJobs();
    res.json(jobs);
  }));

  router.post('/enqueue', asyncHandler(async (req, res) => {
    const { moduleId, params = {}, source = 'api', priority = 0 } = req.body;

    if (!moduleId) {
      return res.json({ error: '缺少 moduleId' });
    }

    const jobId = enqueueJob(moduleId, params, { source, priority });
    res.json({ success: true, jobId });
  }));

  router.delete('/queue', asyncHandler(async (req, res) => {
    clearQueue();
    res.json({ success: true, message: '队列已清空' });
  }));

  return router;
}

module.exports = { createSchedulerRoutes };
