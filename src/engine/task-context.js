class TaskContext {
  constructor(options = {}) {
    this.sessionId = options.sessionId || null;
    this.source = options.source || 'manual';
    this.logger = options.logger || null;
    this.maxReplaces = options.maxReplaces || 3;
    this.replaceCount = 0;
    this.startTime = Date.now();

    this.results = {
      total: 0,
      completed: 0,
      skipped: 0,
      replaced: 0,
      failed: 0,
      canClaim: 0,
    };

    this.stepSeq = 0;
    this.errors = [];
    this.rewards = [];
  }

  nextStepSeq() {
    this.stepSeq += 1;
    return this.stepSeq;
  }

  incrementReplaceCount() {
    this.replaceCount += 1;
    return this.replaceCount;
  }

  canReplace() {
    return this.replaceCount < this.maxReplaces;
  }

  recordResult(status) {
    if (this.results.hasOwnProperty(status)) {
      this.results[status] += 1;
    }
    this.results.total += 1;
  }

  addReward(reward) {
    this.rewards.push(reward);
  }

  addError(error) {
    this.errors.push({
      message: error.message || String(error),
      timestamp: new Date().toISOString(),
    });
  }

  logStep(action, target, status, detail = {}, error = '', durationMs = 0) {
    if (this.logger) {
      this.logger.step(action, target, status, detail, error, durationMs);
    }
  }

  logRequest(cmd, url, statusCode, reqSize, resSize, durationMs, retryCount = 0, error = '') {
    if (this.logger) {
      this.logger.request(cmd, url, statusCode, reqSize, resSize, durationMs, retryCount, error);
    }
  }

  getSummary() {
    return {
      ...this.results,
      replaceCount: this.replaceCount,
      errorCount: this.errors.length,
      durationMs: Date.now() - this.startTime,
      errors: this.errors,
    };
  }

  isAllSuccess() {
    return this.results.failed === 0;
  }

  getStatus() {
    if (this.results.failed > 0 && this.results.completed > 0) return 'partial';
    if (this.results.failed > 0) return 'failed';
    return 'success';
  }
}

module.exports = { TaskContext };
