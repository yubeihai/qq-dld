const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', '..', 'data', 'config.json');

const defaultConfig = {
  testMode: false,
  autoDeleteTestScript: true,
  logRetentionDays: 7,
};

let config = null;

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      config = { ...defaultConfig, ...JSON.parse(data) };
    } else {
      config = { ...defaultConfig };
      saveConfig();
    }
  } catch (e) {
    config = { ...defaultConfig };
  }
  return config;
}

function saveConfig() {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function get(key) {
  if (!config) loadConfig();
  return config[key];
}

function getAll() {
  if (!config) loadConfig();
  return { ...config };
}

function set(key, value) {
  if (!config) loadConfig();
  config[key] = value;
  saveConfig();
  return config;
}

function update(newConfig) {
  if (!config) loadConfig();
  config = { ...config, ...newConfig };
  saveConfig();
  return config;
}

function deleteTestScript(scriptPath) {
  if (!get('autoDeleteTestScript')) return false;
  
  try {
    if (fs.existsSync(scriptPath)) {
      fs.unlinkSync(scriptPath);
      return true;
    }
  } catch (e) {
    console.error('删除测试脚本失败:', e.message);
  }
  return false;
}

function isTestMode() {
  return get('testMode') === true;
}

module.exports = {
  loadConfig,
  saveConfig,
  get,
  getAll,
  set,
  update,
  deleteTestScript,
  isTestMode,
};