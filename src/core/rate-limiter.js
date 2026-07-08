class RateLimiter {
  constructor(options = {}) {
    this.minDelay = options.minDelay || 1500;
    this.lastCallTime = 0;
  }

  async acquire() {
    const now = Date.now();
    const elapsed = now - this.lastCallTime;
    if (elapsed < this.minDelay) {
      const waitTime = this.minDelay - elapsed;
      await this.delay(waitTime);
    }
    this.lastCallTime = Date.now();
  }

  async wait(ms = null) {
    const waitTime = ms || this.minDelay;
    await this.delay(waitTime);
    this.lastCallTime = Date.now();
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  reset() {
    this.lastCallTime = 0;
  }
}

module.exports = { RateLimiter };
