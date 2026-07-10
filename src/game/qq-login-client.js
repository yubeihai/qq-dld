const XUIBASE = 'https://xui.ptlogin2.qq.com';
const GRAPH_BASE = 'https://graph.qq.com';
const GAME_SITE = 'https://dld.qzapp.z.qq.com';

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const REFERER = 'https://xui.ptlogin2.qq.com/';

function hash33(s) {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash += (hash << 5) + s.charCodeAt(i);
  }
  return hash & 0x7fffffff;
}

function parseSetCookie(response) {
  const cookies = {};
  const setCookies = response.headers.getSetCookie?.() ?? [];
  for (const header of setCookies) {
    const parts = header.split(';');
    const pair = parts[0];
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    const isDelete = parts.some(p => {
      const t = p.trim().toLowerCase();
      return t.startsWith('expires=') && t.includes('1970');
    });
    if (isDelete && cookies[name]) continue;
    cookies[name] = value;
  }
  return cookies;
}

function cookieHeader(jar) {
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

function mergeCookies(jar, incoming) {
  for (const [k, v] of Object.entries(incoming)) {
    if (!v && jar.has(k)) continue;
    jar.set(k, v);
  }
}

class QqLoginClient {
  async initSession() {
    const jar = new Map();
    const s_url = encodeURIComponent(`${GRAPH_BASE}/oauth2.0/login_jump`);
    const xurl = `${XUIBASE}/cgi-bin/xlogin?appid=716027609&daid=383&style=33&login_text=${encodeURIComponent('登录')}&hide_title_bar=1&hide_border=1&target=self&s_url=${s_url}&pt_3rd_aid=102067279`;
    let currentUrl = xurl;
    for (let i = 0; i < 5; i++) {
      const res = await fetch(currentUrl, {
        headers: { 'User-Agent': DEFAULT_UA, ...(jar.size ? { Cookie: cookieHeader(jar) } : {}) },
        redirect: 'manual',
      });
      mergeCookies(jar, parseSetCookie(res));
      if (res.status < 300 || res.status >= 400) break;
      const loc = res.headers.get('location');
      if (!loc) break;
      currentUrl = new URL(loc, currentUrl).href;
    }
    return jar;
  }

  async getQrCode(jar) {
    const t = Math.random();
    const s_url = encodeURIComponent(`${GRAPH_BASE}/oauth2.0/login_jump`);
    const url = `${XUIBASE}/ssl/ptqrshow?appid=716027609&e=2&l=M&s=3&d=72&v=4&t=${t}&daid=383&pt_3rd_aid=102067279&u1=${s_url}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': DEFAULT_UA, Cookie: cookieHeader(jar) },
    });
    if (!res.ok) throw new Error(`ptqrshow failed: ${res.status}`);
    mergeCookies(jar, parseSetCookie(res));
    const qrsig = jar.get('qrsig');
    if (!qrsig) throw new Error('qrsig not found in ptqrshow Set-Cookie');
    const buf = Buffer.from(await res.arrayBuffer());
    const qrImage = `data:image/png;base64,${buf.toString('base64')}`;
    return { qrImage, qrsig };
  }

  async checkStatus(jar, ptqrtoken) {
    const u1 = encodeURIComponent(`${GRAPH_BASE}/oauth2.0/login_jump`);
    const loginSig = encodeURIComponent(jar.get('pt_login_sig') || '');
    const ts = Date.now();
    const url = `${XUIBASE}/ssl/ptqrlogin?u1=${u1}&ptqrtoken=${ptqrtoken}` +
      `&ptredirect=0&h=1&t=1&g=1&from_ui=1&ptlang=2052&action=0-0-${ts}` +
      `&js_ver=26030415&js_type=1&login_sig=${loginSig}&pt_uistyle=40` +
      `&aid=716027609&daid=383&pt_3rd_aid=102067279&&o1vId=&pt_js_version=b515fdc3`;
    const res = await fetch(url, {
      headers: { 'User-Agent': DEFAULT_UA, Referer: REFERER, Cookie: cookieHeader(jar) },
    });
    if (!res.ok) throw new Error(`ptqrlogin failed: ${res.status}`);
    mergeCookies(jar, parseSetCookie(res));
    const body = await res.text();
    return parsePtuiCB(body);
  }

  async completeLogin(callbackUrl, jar, nickname) {
    let currentUrl = callbackUrl;
    for (let i = 0; i < 10; i++) {
      const res = await fetch(currentUrl, {
        headers: { 'User-Agent': DEFAULT_UA, Cookie: cookieHeader(jar) },
        redirect: 'manual',
      });
      const sc = parseSetCookie(res);
      for (const [k, v] of Object.entries(sc)) jar.set(k, v);
      if (res.status < 300 || res.status >= 400) { await res.text(); break; }
      const loc = res.headers.get('location');
      if (!loc) break;
      currentUrl = new URL(loc, currentUrl).href;
    }

    const pSkey = jar.get('p_skey') || '';
    let gTk = 5381;
    for (let i = 0; i < pSkey.length; i++) {
      gTk += (gTk << 5) + pSkey.charCodeAt(i);
    }
    gTk = gTk & 0x7fffffff;

    const authTime = Date.now();
    const ui = jar.get('ui') || '';
    const authorizeUrl = `${GRAPH_BASE}/oauth2.0/authorize`;
    const showUrl = `${GRAPH_BASE}/oauth2.0/show?which=Login&display=pc&response_type=code&client_id=102067279&redirect_uri=${encodeURIComponent('https://dld.qzapp.z.qq.com/index.php')}&scope=all`;
    const formBody = new URLSearchParams({
      response_type: 'code',
      client_id: '102067279',
      redirect_uri: 'https://dld.qzapp.z.qq.com/index.php',
      scope: 'all',
      from_ptlogin: '1',
      src: '1',
      update_auth: '0',
      openapi: '#',
      g_tk: String(gTk),
      auth_time: String(authTime),
      ui: ui,
    }).toString();

    const authRes = await fetch(authorizeUrl, {
      method: 'POST',
      headers: {
        'User-Agent': DEFAULT_UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: showUrl,
        Cookie: cookieHeader(jar),
      },
      body: formBody,
      redirect: 'manual',
    });
    mergeCookies(jar, parseSetCookie(authRes));

    let oauthCode = null;
    if (authRes.status >= 300 && authRes.status < 400) {
      const loc = authRes.headers.get('location');
      if (loc) oauthCode = loc.match(/[?&]code=([^&]+)/)?.[1] || null;
    } else if (authRes.status === 200) {
      try {
        const text = await authRes.text();
        const json = JSON.parse(text);
        if (json.ret === 0 && json.callback) {
          oauthCode = json.callback.match(/[?&]code=([^&]+)/)?.[1] || null;
        }
      } catch {}
    }

    if (!oauthCode) throw new Error('OAuth authorization code not obtained from authorize endpoint');

    const gameUrl = `${GAME_SITE}/index.php?code=${encodeURIComponent(oauthCode)}`;
    let current = gameUrl;
    for (let i = 0; i < 10; i++) {
      const res = await fetch(current, {
        headers: { 'User-Agent': DEFAULT_UA, Cookie: cookieHeader(jar) },
        redirect: 'manual',
      });
      const sc = parseSetCookie(res);
      for (const [k, v] of Object.entries(sc)) jar.set(k, v);
      if (res.status < 300 || res.status >= 400) break;
      const loc = res.headers.get('location');
      if (!loc) break;
      current = new URL(loc, current).href;
    }

    const uin = extractUin(jar);
    if (!uin) throw new Error('uin could not be extracted from cookies');
    return { cookieString: cookieHeader(jar), uin, nickname };
  }
}

function parsePtuiCB(body) {
  const codeMatch = body.match(/ptuiCB\('(\d+)'/);
  if (!codeMatch) throw new Error('ptuiCB status code not found');
  const code = parseInt(codeMatch[1], 10);
  if (code !== 0) return { code };

  const argsMatch = body.match(/ptuiCB\((.+)\)/);
  if (!argsMatch) throw new Error('ptuiCB args not found');
  const rawArgs = argsMatch[1];
  const args = [];
  let current = '';
  let inQuote = false;
  for (const ch of rawArgs) {
    if (ch === "'") { inQuote = !inQuote; continue; }
    if (ch === ',' && !inQuote) { args.push(current); current = ''; continue; }
    current += ch;
  }
  if (current) args.push(current);

  const callbackUrl = args[2]?.trim();
  const nickname = args[5]?.trim();
  if (!callbackUrl) throw new Error('ptuiCB callback URL not extracted');
  return { code, callbackUrl, nickname };
}

function extractUin(jar) {
  const raw = jar.get('uin') || jar.get('pt2gguin') || jar.get('newuin') || '';
  return raw.replace(/^o/, '');
}

module.exports = { QqLoginClient, hash33, parseSetCookie, cookieHeader, mergeCookies };
