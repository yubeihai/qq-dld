const crypto = require('crypto');
const { logSessions, logSteps, logRequests } = require('../db');

class SessionLogger {
  constructor(moduleId, moduleName, source = 'manual') {
    this.moduleId = moduleId;
    this.moduleName = moduleName;
    this.source = source;
    this.sessionId = null;
    this.stepSeq = 0;
    this.startTime = null;
  }

  start(params = {}) {
    this.sessionId = crypto.randomUUID();
    this.startTime = Date.now();
    logSessions.create({
      id: this.sessionId,
      module_id: this.moduleId,
      module_name: this.moduleName,
      source: this.source,
      params: JSON.stringify(params),
    });
    return this.sessionId;
  }

  step(action, target = '', status = 'success', detail = {}, error = '', durationMs = 0) {
    if (!this.sessionId) {
      throw new Error('Logger 未启动，请先调用 start()');
    }
    this.stepSeq += 1;
    logSteps.add({
      session_id: this.sessionId,
      seq: this.stepSeq,
      action,
      target,
      status,
      detail,
      error,
      duration_ms: durationMs,
    });
  }

  request(cmd, url, statusCode, reqSize, resSize, durationMs, retryCount = 0, error = '') {
    if (!this.sessionId) return;
    logRequests.add({
      session_id: this.sessionId,
      cmd,
      url,
      status_code: statusCode,
      request_size: reqSize,
      response_size: resSize,
      duration_ms: durationMs,
      retry_count: retryCount,
      error,
    });
    logSessions.incrementRequestCount(this.sessionId);
  }

  end(status = 'success', summary = {}) {
    if (!this.sessionId) return;
    const now = new Date().toISOString();
    const duration = this.startTime ? Date.now() - this.startTime : 0;
    logSessions.update(this.sessionId, {
      status,
      summary: JSON.stringify(summary),
      ended_at: now,
      duration_ms: duration,
    });
    return {
      sessionId: this.sessionId,
      status,
      duration,
      summary,
    };
  }
}

module.exports = { SessionLogger };
