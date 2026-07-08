const { cookieDb } = require('../db');

class CookieManager {
  constructor() {
    this._cache = null;
    this._cacheTime = 0;
    this._cacheTTL = 5000;
  }

  async get() {
    const now = Date.now();
    if (this._cache && (now - this._cacheTime) < this._cacheTTL) {
      return this._cache;
    }

    const record = cookieDb.get();
    if (!record || !record.value) {
      throw new Error('未登录，请先扫码登录');
    }

    this._cache = record.value;
    this._cacheTime = now;
    return this._cache;
  }

  set(value) {
    cookieDb.set(value);
    this._cache = value;
    this._cacheTime = Date.now();
  }

  invalidate() {
    cookieDb.clear();
    this._cache = null;
    this._cacheTime = 0;
  }

  async exists() {
    const record = cookieDb.get();
    return !!(record && record.value);
  }
}

module.exports = { CookieManager };
