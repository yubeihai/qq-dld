const axios = require('axios');
const { cookieDb } = require('../db');

const BASE_URL = 'https://dld.qzapp.z.qq.com/qpet/cgi-bin/phonepk';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36',
  'Referer': 'https://dld.qzapp.z.qq.com/',
};

const REQUEST_DELAY = 1500;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

const BUSY_PATTERNS = [
  '很抱歉，系统繁忙',
  '系统繁忙',
  '请稍后再试',
  '请求过于频繁',
];

let lastRequestTime = 0;

class GameClient {
  constructor() {
    this.cookie = null;
  }

  async getCookie() {
    if (this.cookie) return this.cookie;
    
    const record = cookieDb.get();
    if (!record) {
      throw new Error('未登录，请先扫码登录');
    }
    this.cookie = record.value;
    return this.cookie;
  }

  clearCookie() {
    this.cookie = null;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isSystemBusy(html) {
    if (!html || typeof html !== 'string') return false;
    return BUSY_PATTERNS.some(pattern => html.includes(pattern));
  }

  isLoginExpired(html) {
    if (!html || typeof html !== 'string') return false;
    return html.includes('location.replace') || 
           html.includes('ptlogin2.qq.com') ||
           html.includes('请先登录') ||
           html.includes('未登录');
  }

  async checkLoginStatus() {
    try {
      const cookie = await this.getCookie();
      const url = `${BASE_URL}?cmd=index`;
      
      const response = await axios.get(url, {
        headers: { ...DEFAULT_HEADERS, Cookie: cookie },
        timeout: 10000,
      });
      
      const html = response.data;
      
      if (this.isLoginExpired(html)) {
        this.clearCookie();
        cookieDb.clear();
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  async request(cmd, params = {}, retryCount = 0) {
    const cookie = await this.getCookie();
    
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < REQUEST_DELAY) {
      await this.delay(REQUEST_DELAY - elapsed);
    }
    
    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    
    const url = `${BASE_URL}?cmd=${cmd}&channel=0&g_ut=1${queryString ? '&' + queryString : ''}`;
    
    try {
      lastRequestTime = Date.now();
      
      const response = await axios.get(url, {
        headers: { ...DEFAULT_HEADERS, Cookie: cookie },
        timeout: 15000,
      });
      
      const html = response.data;
      
      if (this.isLoginExpired(html)) {
        this.clearCookie();
        cookieDb.clear();
        throw new Error('登录已过期，请重新扫码登录');
      }
      
      if (this.isSystemBusy(html)) {
        if (retryCount < MAX_RETRIES) {
          console.log(`[重试] 系统繁忙，${RETRY_DELAY}ms后重试 (${retryCount + 1}/${MAX_RETRIES})`);
          await this.delay(RETRY_DELAY);
          return this.request(cmd, params, retryCount + 1);
        }
        throw new Error('系统繁忙，多次重试后仍无法访问');
      }
      
      return html;
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('请求超时，请检查网络连接');
      }
      throw error;
    }
  }

  async fetchUrl(url) {
    const cookie = await this.getCookie();
    
    const response = await axios.get(url, {
      headers: { ...DEFAULT_HEADERS, Cookie: cookie },
      timeout: 15000,
    });
    
    return response.data;
  }

  extractLinks(html) {
    if (!html) return [];
    
    const links = [];
    const regex = /<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      let url = match[1].replace(/&amp;/g, '&');
      let text = match[2].replace(/<[^>]+>/g, '').trim();
      
      if (!url || url.startsWith('javascript:') || url === '#') continue;
      if (url.startsWith('//')) url = 'https:' + url;
      if (url.startsWith('/')) url = 'https://dld.qzapp.z.qq.com' + url;
      
      links.push({ url, text });
    }
    
    const uniqueMap = new Map();
    links.forEach(l => uniqueMap.set(l.url, l.text || uniqueMap.get(l.url) || ''));
    
    return [...uniqueMap].map(([url, text]) => ({ url, text }));
  }

  extractText(html) {
    if (!html) return '';
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  matchPattern(html, patterns) {
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) return match[0];
    }
    return null;
  }
}

const client = new GameClient();

module.exports = {
  GameClient,
  client,
  BASE_URL,
};