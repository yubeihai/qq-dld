const schedule = require('node-schedule');
const { getAction } = require('../actions');
const { moduleConfigs } = require('../db');

const jobs = {};

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
      console.log(`[定时任务] ${time} 执行...`);
      
      const modules = timeGroups[time];
      for (const config of modules) {
        const action = getAction(config.id);
        if (!action) continue;
        try {
          console.log(`[定时任务] 执行 ${action.name}...`);
          await action.run();
        } catch (error) {
          console.error(`[定时任务] ${action.name} 执行失败:`, error.message);
        }
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

module.exports = {
  startScheduler,
  stopScheduler,
  restartScheduler,
};