const PTLOGIN_BASE = 'https://ssl.ptlogin2.qq.com';
const GRAPH_BASE = 'https://graph.qq.com';
const GAME_SITE = 'https://dld.qzapp.z.qq.com';

const PTQRSHOW_PARAMS =
  'appid=716027609&daid=383&pt_3rd_aid=102067279&e=2&l=M&s=3&d=72&v=4';

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface CheckStatusResult {
  code: number;
  callbackUrl?: string;
  nickname?: string;
}

export interface CompleteLoginResult {
  cookieString: string;
  uin: string;
  nickname?: string;
}

export function hash33(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash += (hash << 5) + s.charCodeAt(i);
  }
  return hash & 0x7fffffff;
}

export function parsePtuiCB(body: string): CheckStatusResult {
  const codeMatch = body.match(/ptuiCB\('(\d+)'/);
  if (!codeMatch) {
    throw new Error('ptuiCB status code not found in ptqrlogin response');
  }
  const code = parseInt(codeMatch[1], 10);
  if (code !== 0) {
    return { code };
  }
  const successMatch = body.match(
    /ptuiCB\('0',\d+,'([^']*)',\d+,'[^']*','([^']*)'\)/,
  );
  if (!successMatch) {
    throw new Error('ptuiCB success callback URL not parseable');
  }
  return { code, callbackUrl: successMatch[1], nickname: successMatch[2] };
}

function parseSetCookie(response: Response): Record<string, string> {
  const cookies: Record<string, string> = {};
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = headers.getSetCookie?.() ?? [];
  for (const header of setCookies) {
    const pair = header.split(';')[0];
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      cookies[name] = value;
    }
  }
  return cookies;
}

function cookieHeader(jar: Map<string, string>): string {
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function mergeCookies(jar: Map<string, string>, incoming: Record<string, string>): void {
  for (const [k, v] of Object.entries(incoming)) {
    jar.set(k, v);
  }
}

export class QqLoginClient {
  async getQrCode(jar: Map<string, string>): Promise<{ qrImage: string; qrsig: string }> {
    const t = Math.floor(Math.random() * 1_000_000_000);
    const url = `${PTLOGIN_BASE}/ptqrshow?${PTQRSHOW_PARAMS}&t=${t}`;
    const res = await fetch(url, { headers: { 'User-Agent': DEFAULT_UA } });
    if (!res.ok) {
      throw new Error(`ptqrshow request failed: ${res.status}`);
    }
    mergeCookies(jar, parseSetCookie(res));
    const qrsig = jar.get('qrsig');
    if (!qrsig) {
      throw new Error('qrsig not found in ptqrshow Set-Cookie response');
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const qrImage = `data:image/png;base64,${buf.toString('base64')}`;
    return { qrImage, qrsig };
  }

  async checkStatus(jar: Map<string, string>, ptqrtoken: number): Promise<CheckStatusResult> {
    const u1 = encodeURIComponent(`${GRAPH_BASE}/oauth2.0/login_jump`);
    const url =
      `${PTLOGIN_BASE}/ptqrlogin?u1=${u1}&ptqrtoken=${ptqrtoken}` +
      `&service=ptqr&nodirect=0&ptui-style=40&daid=383&pt_3rd_aid=102067279`;
    const res = await fetch(url, {
      headers: { 'User-Agent': DEFAULT_UA, Cookie: cookieHeader(jar) },
    });
    if (!res.ok) {
      throw new Error(`ptqrlogin request failed: ${res.status}`);
    }
    mergeCookies(jar, parseSetCookie(res));
    const body = await res.text();
    return parsePtuiCB(body);
  }

  async completeLogin(
    callbackUrl: string,
    jar: Map<string, string>,
    nickname?: string,
  ): Promise<CompleteLoginResult> {
    const res1 = await fetch(callbackUrl, {
      headers: { 'User-Agent': DEFAULT_UA, Cookie: cookieHeader(jar) },
      redirect: 'manual',
    });
    mergeCookies(jar, parseSetCookie(res1));

    const code = new URL(callbackUrl).searchParams.get('code');
    if (!code) {
      throw new Error('OAuth code not found in callback URL');
    }

    const gameUrl = `${GAME_SITE}/index.php?code=${encodeURIComponent(code)}`;
    const res2 = await fetch(gameUrl, {
      headers: { 'User-Agent': DEFAULT_UA, Cookie: cookieHeader(jar) },
      redirect: 'manual',
    });
    mergeCookies(jar, parseSetCookie(res2));

    const uin = this.extractUin(jar);
    if (!uin) {
      throw new Error('uin could not be extracted from login cookies');
    }
    return { cookieString: cookieHeader(jar), uin, nickname };
  }

  private extractUin(jar: Map<string, string>): string {
    const raw = jar.get('uin') || jar.get('pt2gguin') || '';
    return raw.replace(/^o/, '');
  }
}

export const qqLoginClient = new QqLoginClient();
