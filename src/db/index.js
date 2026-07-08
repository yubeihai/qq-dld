const { initDb, saveDb, saveDbNow } = require('./connection');

const { execLogs } = require('./repositories/exec-log-repo');
const { logSessions } = require('./repositories/log-session-repo');
const { logSteps } = require('./repositories/log-step-repo');
const { logRequests } = require('./repositories/log-request-repo');
const { cookieRepo } = require('./repositories/cookie-repo');
const { moduleConfigs } = require('./repositories/module-config-repo');
const { friendRepo } = require('./repositories/friend-repo');
const { settings } = require('./repositories/settings-repo');
const { taskTypes, taskConfigs } = require('./repositories/task-repo');
const { factionTaskTypes, factionTaskConfigs } = require('./repositories/faction-repo');
const { knightMissionTypes, knightMissionConfigs } = require('./repositories/knight-mission-repo');
const { badgeTypes, badgeConfigs } = require('./repositories/badge-repo');
const { exchangeTypes, exchangeConfigs } = require('./repositories/exchange-repo');

module.exports = {
  initDb,
  saveDb,
  saveDbNow,

  execLogs,
  logSessions,
  logSteps,
  logRequests,

  cookieDb: cookieRepo,
  moduleConfigs,
  friends: friendRepo,
  settings,
  taskTypes,
  taskConfigs,
  factionTaskTypes,
  factionTaskConfigs,
  knightMissionTypes,
  knightMissionConfigs,
  badgeTypes,
  badgeConfigs,
  exchangeTypes,
  exchangeConfigs,
};
