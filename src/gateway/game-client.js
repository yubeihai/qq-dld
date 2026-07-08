const axios = require('axios');
const { RateLimiter } = require('../core/rate-limiter');
const { CookieManager } = require('./cookie-manager');
const { HtmlParser } = require('./html-parser');

const BASE_URL = 'https://dld.qzapp.z.qq.com/qpet/cgi-bin/phonepk';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36',
  'Referer': 'https://dld.qzapp.z.qq.com/',
};

class GameClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || BASE_URL;
    this.timeout = options.timeout || 15000;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 2000;

    this.rateLimiter = options.rateLimiter || new RateLimiter({ minDelay: options.requestDelay || 1500 });
    this.cookieManager = options.cookieManager || new CookieManager();
    this.parser = new HtmlParser();

    this.onRequest = options.onRequest || null;
    this.onError = options.onError || null;
  }

  async request(cmd, params = {}, retryCount = 0) {
    await this.rateLimiter.acquire();

    const cookie = await this.cookieManager.get();
    const url = this.buildUrl(cmd, params);

    try {
      const start = Date.now();
      const response = await axios.get(url, {
        headers: { ...DEFAULT_HEADERS, Cookie: cookie },
        timeout: this.timeout,
      });
      const elapsed = Date.now() - start;

      const html = response.data;

      if (this.parser.isLoginExpired(html)) {
        await this.cookieManager.invalidate();
        throw new Error('登录已过期，请重新扫码登录');
      }

      if (this.parser.isSystemBusy(html)) {
        if (retryCount < this.maxRetries) {
          await this.rateLimiter.wait(this.retryDelay);
          return this.request(cmd, params, retryCount + 1);
        }
        throw new Error('系统繁忙，多次重试后仍无法访问');
      }

      if (this.onRequest) {
        this.onRequest({
          cmd,
          url,
          status_code: response.status,
          request_size: 0,
          response_size: html.length,
          duration_ms: elapsed,
          retry_count: retryCount,
        });
      }

      return html;
    } catch (error) {
      if (error.response) {
        if (this.onRequest) {
          this.onRequest({
            cmd,
            url,
            status_code: error.response.status,
            duration_ms: Date.now() - (start || Date.now()),
            retry_count: retryCount,
            error: error.response.statusText,
          });
        }
        throw new Error(`请求失败 (${error.response.status}): ${error.response.statusText}`);
      }

      if (error.code === 'ECONNABORTED') {
        throw new Error('请求超时，请检查网络连接');
      }

      throw error;
    }
  }

  async fetchUrl(url) {
    await this.rateLimiter.acquire();
    const cookie = await this.cookieManager.get();

    const response = await axios.get(url, {
      headers: { ...DEFAULT_HEADERS, Cookie: cookie },
      timeout: this.timeout,
    });

    return response.data;
  }

  buildUrl(cmd, params = {}) {
    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');

    return `${this.baseUrl}?cmd=${cmd}&channel=0&g_ut=1${queryString ? '&' + queryString : ''}`;
  }

  extractLinks(html) {
    return this.parser.extractLinks(html);
  }

  extractText(html) {
    return this.parser.extractText(html);
  }

  matchPattern(html, patterns) {
    return this.parser.matchPattern(html, patterns);
  }

  async checkLoginStatus() {
    try {
      const html = await this.request('index');
      return !this.parser.isLoginExpired(html);
    } catch {
      return false;
    }
  }

  clearCookie() {
    this.cookieManager.invalidate();
  }
}

const client = new GameClient();

module.exports = { GameClient, client, BASE_URL };
