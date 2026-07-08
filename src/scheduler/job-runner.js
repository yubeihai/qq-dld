const { getAction } = require('../actions');
const { taskEngine } = require('../engine/task-engine');
const { SessionLogger } = require('../core/session-logger');

class JobRunner {
  constructor(options = {}) {
    this.requestDelay = options.requestDelay || 1500;
    this.lastRequestTime = 0;
  }

  async runJob(job) {
    const action = getAction(job.moduleId);

    if (!action) {
      throw new Error(`模块 ${job.moduleId} 不存在`);
    }

    const logger = new SessionLogger(job.moduleId, action.name, job.source);
    logger.start({ ...job.params, source: job.source, jobId: job.id });

    try {
      await this._rateLimit();

      const params = {
        ...job.params,
        source: job.source || 'scheduler',
      };

      const result = await action.run(params);

      const status = result && result.success ? 'success' : 'partial';
      logger.end(status, { result });

      return {
        success: result && result.success,
        status,
        sessionId: logger.sessionId,
        data: result,
      };
    } catch (error) {
      logger.end('failed', { error: error.message });
      throw error;
    }
  }

  async runTaskList(tasks, options = {}) {
    return taskEngine.executeAll(tasks, {
      source: options.source || 'scheduler',
      maxReplaces: options.maxReplaces || 3,
    });
  }

  async _rateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.requestDelay) {
      await new Promise(resolve => setTimeout(resolve, this.requestDelay - elapsed));
    }
    this.lastRequestTime = Date.now();
  }
}

const jobRunner = new JobRunner();

module.exports = { JobRunner, jobRunner };
