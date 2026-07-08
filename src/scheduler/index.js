const schedule = require('node-schedule');
const { getAction, registry } = require('../actions');
const { moduleConfigs } = require('../db');
const { JobQueue } = require('./job-queue');
const { jobRunner } = require('./job-runner');

const jobs = {};
const jobQueue = new JobQueue({
  concurrency: 1,
  onJobStart: (job) => {
    console.log(`[队列] 开始执行: ${job.moduleId} (${job.id})`);
  },
  onJobEnd: (job, error) => {
    const status = error ? '失败' : '完成';
    const duration = job.endedAt - job.startedAt;
    console.log(`[队列] ${job.moduleId} ${status} (${duration}ms)`);
    if (error) {
      console.error(`[队列] ${job.moduleId} 错误:`, error.message);
    }
  },
});

jobQueue.onComplete = async (job) => {
  return jobRunner.runJob(job);
};

function parseTime(timeStr) {
  const [hour, minute] = timeStr.split(':').map(Number);
  return { hour, minute };
}

function parseTimes(timesStr) {
  if (!timesStr) return [];
  return timesStr.split(',').map(t => t.trim()).filter(t => t.includes(':'));
}

function startScheduler() {
  stopScheduler();

  const configs = moduleConfigs.getEnabledAutoModules();

  if (configs.length === 0) {
    console.log('没有启用的定时任务');
    return;
  }

  const timeGroups = {};
  configs.forEach(config => {
    const times = parseTimes(config.auto_time);
    times.forEach(time => {
      if (!timeGroups[time]) {
        timeGroups[time] = [];
      }
      timeGroups[time].push(config);
    });
  });

  Object.keys(timeGroups).forEach(time => {
    const { hour, minute } = parseTime(time);

    const job = schedule.scheduleJob({ hour, minute }, async () => {
      console.log(`[定时任务] ${time} 触发，加入队列...`);

      const modules = timeGroups[time];
      for (const config of modules) {
        jobQueue.enqueue({
          moduleId: config.id,
          params: config.params ? JSON.parse(config.params || '{}') : {},
          source: 'scheduler',
          priority: 0,
        });
      }
    });

    jobs[time] = job;
    console.log(`已设置定时任务：每天 ${time} 执行 ${timeGroups[time].map(c => c.name).join('、')}`);
  });
}

function stopScheduler() {
  Object.values(jobs).forEach(job => {
    if (job) job.cancel();
  });
  Object.keys(jobs).forEach(key => delete jobs[key]);
}

function restartScheduler() {
  console.log('重启定时任务...');
  startScheduler();
}

function enqueueJob(moduleId, params = {}, options = {}) {
  return jobQueue.enqueue({
    moduleId,
    params,
    source: options.source || 'api',
    priority: options.priority || 0,
  });
}

function getSchedulerStatus() {
  const scheduledTimes = Object.keys(jobs);
  const queueStatus = jobQueue.getStatus();

  return {
    running: scheduledTimes.length > 0,
    jobCount: scheduledTimes.length,
    times: scheduledTimes,
    queue: queueStatus,
  };
}

function getQueueStatus() {
  return jobQueue.getStatus();
}

function getQueueJobs() {
  return jobQueue.getJobs();
}

function clearQueue() {
  jobQueue.clear();
}

module.exports = {
  startScheduler,
  stopScheduler,
  restartScheduler,
  getSchedulerStatus,
  enqueueJob,
  getQueueStatus,
  getQueueJobs,
  clearQueue,
};
