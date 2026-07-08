const { initDb } = require('../db');
const { createApp } = require('./app');
const { startScheduler } = require('../scheduler');

const PORT = process.env.PORT || 3000;

async function start() {
  console.log('正在初始化数据库...');
  await initDb();
  console.log('数据库初始化完成');

  const app = createApp();

  app.listen(PORT, () => {
    console.log(`QQ 大乐斗助手已启动：http://localhost:${PORT}`);
    startScheduler();
  });
}

start().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});

module.exports = createApp();
