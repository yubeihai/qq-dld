const path = require('path');
const { registry } = require('../modules/registry');

// 自动发现并注册 actions 目录下的所有模块
const actionsDir = __dirname;
registry.discoverSync(actionsDir);

// 向后兼容: 导出 registry 方法
function getAction(id) {
  return registry.get(id);
}

function getAllActions() {
  return registry.getAll();
}

function getRegistry() {
  return registry;
}

// 向后兼容: 直接导出所有 action 实例
const exportsObj = {
  registry,
  getAction,
  getAllActions,
  getRegistry,
};

// 导出所有已注册的 action
for (const [id, action] of registry.modules) {
  exportsObj[action.constructor.name] = action.constructor;
  exportsObj[id] = action;
}

module.exports = exportsObj;
