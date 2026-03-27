const { client } = require('./game-client');
const { execLogs } = require('../db');

class ActionBase {
  constructor(config = {}) {
    this.id = config.id || this.constructor.name.toLowerCase();
    this.name = config.name || this.constructor.name;
    this.description = config.description || '';
    this.category = config.category || '其他';
  }

  async run(params = {}) {
    throw new Error('子类必须实现 run() 方法');
  }

  async request(cmd, params = {}) {
    return client.request(cmd, params);
  }

  async fetchUrl(url) {
    return client.fetchUrl(url);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  extractLinks(html) {
    return client.extractLinks(html);
  }

  extractText(html) {
    return client.extractText(html);
  }

  matchPattern(html, patterns) {
    return client.matchPattern(html, patterns);
  }

  log(result, status = 'success') {
    const resultText = typeof result === 'string' ? result : JSON.stringify(result);
    execLogs.add(this.id, this.name, `#${this.id}`, resultText, status);
  }

  success(data = {}) {
    return { success: true, ...data };
  }

  fail(error) {
    return { success: false, error: error.message || error };
  }
}

module.exports = {
  ActionBase,
};