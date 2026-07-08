class JobQueue {
  constructor(options = {}) {
    this.queue = [];
    this.running = false;
    this.concurrency = options.concurrency || 1;
    this.activeJobs = 0;
    this.onComplete = options.onComplete || null;
    this.onJobStart = options.onJobStart || null;
    this.onJobEnd = options.onJobEnd || null;
    this._processPromise = null;
  }

  enqueue(job) {
    const jobItem = {
      id: job.id || `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      moduleId: job.moduleId,
      params: job.params || {},
      source: job.source || 'scheduler',
      priority: job.priority || 0,
      status: 'pending',
      createdAt: Date.now(),
      startedAt: null,
      endedAt: null,
      result: null,
      error: null,
    };

    this.queue.push(jobItem);
    this.queue.sort((a, b) => b.priority - a.priority);

    this._process();

    return jobItem.id;
  }

  async _process() {
    if (this._processPromise) return;
    this._processPromise = this._processLoop();
    await this._processPromise;
    this._processPromise = null;
  }

  async _processLoop() {
    while (this.queue.length > 0 && this.activeJobs < this.concurrency) {
      const job = this.queue.shift();
      this.activeJobs++;
      job.status = 'running';
      job.startedAt = Date.now();

      if (this.onJobStart) {
        this.onJobStart(job);
      }

      this._runJob(job).catch(() => {});
    }
  }

  async _runJob(job) {
    try {
      if (!this.onComplete) {
        throw new Error('未设置任务处理器');
      }

      const result = await this.onComplete(job);
      job.status = 'completed';
      job.result = result;
      job.endedAt = Date.now();

      if (this.onJobEnd) {
        this.onJobEnd(job, null);
      }
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.endedAt = Date.now();

      if (this.onJobEnd) {
        this.onJobEnd(job, error);
      }
    } finally {
      this.activeJobs--;
      this._process();
    }
  }

  getPendingCount() {
    return this.queue.filter(j => j.status === 'pending').length;
  }

  getRunningCount() {
    return this.activeJobs;
  }

  getJobs() {
    return [...this.queue];
  }

  clear() {
    this.queue = [];
  }

  getStatus() {
    return {
      pending: this.getPendingCount(),
      running: this.getRunningCount(),
      total: this.queue.length + this.activeJobs,
    };
  }
}

module.exports = { JobQueue };
