---
change: auth-and-account
design-doc: docs/superpowers/specs/2026-07-09-auth-and-account-design.md
base-ref: e8ec42b8e5d05f39e56b7cc7af2d0085b63386d7
---

# Auth and Account Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the puppeteer-based login with an HTTP-only QQ QR login flow, add JWT auth + multi-account management with per-account cookie isolation, and wire it into the existing Fastify server and Vue3 frontend.

**Architecture:** Backend calls QQ ptlogin2 HTTP APIs directly (no browser). `QqLoginClient` drives the QR flow (ptqrshow -> ptqrlogin -> OAuth chain), `QrSessionManager` holds concurrent in-memory sessions, `AuthModule` signs/verifies JWTs (jsonwebtoken, env-only secret), a Fastify `authPreHandler` guards protected routes, `AccountService` wraps `AccountRepo`/`SettingsRepo` for account CRUD + active-account switching, and `CookieManager` isolates cookies per account. The frontend `Login.vue` auto-starts QR login and polls status.

**Tech Stack:** TypeScript, Fastify 4, better-sqlite3, jsonwebtoken, Node 20+ built-in `fetch` (undici), `@qq-dld/shared` types; Vue 3 + Vant + vue-router (hash) + axios on the frontend.

**Design doc:** `docs/superpowers/specs/2026-07-09-auth-and-account-design.md` — reference throughout. Key sections: QR Login Flow (Scheme A), QrSessionManager, QQ Login Client (hash33, ptqrshow params, ptqrlogin status codes, OAuth chain), Account Identification, Frontend (Login.vue), Dependencies, Risks.

## Global Constraints

- **Runtime:** Node 20+ (built-in `fetch` via undici; `crypto.randomUUID` available). No puppeteer, no axios on the backend login path.
- **Module system:** CommonJS (`"module": "CommonJS"` in `tsconfig.base.json`); `esModuleInterop: true`; `strict: true`; **`noUnusedLocals: true` and `noUnusedParameters: true`** — never leave unused vars/params (no `_`-prefix exemption for locals; use explicit object construction instead of destructure-to-omit).
- **Database:** better-sqlite3 is **synchronous** — account/settings operations are sync, not async. `DataLayer.initialize()` is called in `buildServer()`; repos call `DataLayer.getInstance().getDb()`.
- **JWT secret:** env-only, **no fallback** (`JWT_SECRET` must be set at runtime; throw a clear error if missing). HMAC-SHA256, 24h TTL.
- **QQ endpoints (reverse-engineered, per design doc Risks):**
  - ptqrshow: `https://ssl.ptlogin2.qq.com/ptqrshow?appid=716027609&daid=383&pt_3rd_aid=102067279&e=2&l=M&s=3&d=72&v=4&t=<random>`
  - ptqrlogin status codes: `66`=waiting, `67`=scanned, `65`=expired, `0`=success (ptuiCB 1st arg = `0`)
  - OAuth chain: ptuiCB success 3rd arg = `https://graph.qq.com/oauth2.0/login_jump?code=XXX&...`; then `https://dld.qzapp.z.qq.com/index.php?code=XXX`
  - uin: extracted from `uin` or `pt2gguin` cookie, strip leading `o` prefix
- **Implementation mode:** `build_mode=executing-plans`, `tdd_mode=direct`, `review_mode=off`. Direct implementation — no mandatory failing-test-first cycle. Each task ends with a passing `tsc` build/typecheck + commit. Pure-logic units (hash33, ptuiCB parsing) include a direct unit test written alongside the implementation.
- **Commits:** Conventional-commit style (`feat:`, `refactor:`, `chore:`). One commit per task unless a task explicitly splits steps.
- **Platform note:** OS is Windows PowerShell. Env vars in commands use `$env:NAME="value"` syntax.

---

## File Structure

### Backend (`packages/server/src/`)

| File | Action | Responsibility |
|------|--------|----------------|
| `auth/auth-module.ts` | Modify | `signToken` / `verifyToken` / `refreshToken` with jsonwebtoken; env-only secret (remove fallback) |
| `auth/middleware.ts` | Rewrite | Fastify `authPreHandler` preHandler: Bearer extraction, `verifyToken`, attach `request.user`, 401 on missing/invalid |
| `auth/account-service.ts` | Modify | Wrap `AccountRepo` + `SettingsRepo`: add `list`/`toPublic`/`switch`/`getActiveAccountId`/`getCookies`/`updateProfile` |
| `auth/qq-login-client.ts` | Create | `hash33`, `getQrCode` (ptqrshow), `checkStatus` (ptqrlogin + `parsePtuiCB`), `completeLogin` (OAuth chain), Set-Cookie parsing |
| `auth/qr-session-manager.ts` | Create | In-memory `Map<sessionId, QrSession>`; create/get/updateStatus/isExpired/cleanup (2-min TTL) |
| `auth/routes.ts` | Rewrite | Fastify plugin `authRoutes`: `POST /api/auth/qr/start`, `GET /api/auth/qr/status`, `POST /api/auth/logout`; login-success flow (upsert account -> sign JWT -> switch active) |
| `auth/index.ts` | Modify | Barrel: export `authRoutes` (not `createAccountRoutes`), add `authPreHandler`, `refreshToken` |
| `routes/accounts.ts` | Modify | `GET /api/accounts` returns sanitized list (no cookies) |
| `routes/auth.ts` | Delete | Old uin-based `/api/auth/login` Fastify plugin — superseded by QR flow |
| `server.ts` | Modify | Import `authRoutes` from `./auth/routes`; replace inline `authHook` with `authPreHandler`; expand public-route exclusion set; remove `@fastify/jwt` registration; add startup `JWT_SECRET` guard + bootstrap |
| `gateway/cookie-manager.ts` | Modify | Add `switchAccount` / `getActiveAccountId` / `getActiveCookies` / `getCookieHeader` (active-account cookie isolation) |
| `auth/__tests__/qq-login-client.test.ts` | Create | Unit tests for `hash33` and `parsePtuiCB` |
| `package.json` | Modify | Add `start` script; (Task 7) remove `@fastify/jwt` + `@types/express` after their usages are gone |

### Frontend (`packages/web/src/`)

| File | Action | Responsibility |
|------|--------|----------------|
| `pages/Login.vue` | Rewrite | Auto `/qr/start` on mount, display QR, poll `/qr/status` (2s), status mapping UI, expired refresh, success -> store token+account -> redirect `/modules` |

### Out of scope

- Legacy `src/` (CommonJS Express app, `src/game/login.js` puppeteer, root `puppeteer-core` dep) — untouched by this change; retirement is a separate concern.
- TS game-client HTTP injection wiring (change 4) — `CookieManager` exposes the contract here; the request layer consumes it later.

---

## Task 1: Dependencies

**Files:**
- Verify: `packages/server/package.json`
- Verify: `package.json` (root)

**Interfaces:**
- Consumes: existing `packages/server/package.json` deps (`jsonwebtoken@^9.0.3`, `@types/jsonwebtoken@^9.0.10` already present)
- Produces: confirmed dep set; root lockfile refreshed. (Removal of `@fastify/jwt` + `@types/express` is deferred to Task 7, after code stops importing them, so every intermediate task stays green.)

- [ ] **Step 1: Verify jsonwebtoken is present in packages/server**

Run:
```powershell
node -e "const p=require('./packages/server/package.json');console.log('jsonwebtoken:',p.dependencies.jsonwebtoken);console.log('types:',p.devDependencies['@types/jsonwebtoken'])"
```
Expected: `jsonwebtoken: ^9.0.3` and `types: ^9.0.10`. (Task 1.1 of tasks.md is already satisfied — do not re-add.)

- [ ] **Step 2: Confirm puppeteer-core is NOT a packages/server dependency**

Run:
```powershell
node -e "const p=require('./packages/server/package.json');console.log('puppeteer-core in server deps:',!!(p.dependencies&&p.dependencies['puppeteer-core']))"
```
Expected: `puppeteer-core in server deps: false`. (It only lives in the legacy root `package.json` — out of scope. Task 1.3 is a no-op for packages/server.)

- [ ] **Step 3: npm install at root to refresh the lockfile**

Run:
```powershell
npm install
```
Expected: install completes; no new packages added. (Task 1.2.)

- [ ] **Step 4: Verify the server workspace still typechecks (baseline green)**

Run:
```powershell
npm run typecheck --workspace=@qq-dld/server
```
Expected: PASS (no errors). This is the baseline that every later task must preserve.

- [ ] **Step 5: Commit**

```powershell
git add packages/server/package.json package-lock.json
git commit -m "chore(auth): verify auth dependencies (jsonwebtoken) for QR login"
```
(If `npm install` changed no lockfile bytes, stage only `packages/server/package.json` — but prefer keeping a checkpoint commit.)

---

## Task 2: AuthModule (sign / verify / refresh, env-only secret)

**Files:**
- Modify: `packages/server/src/auth/auth-module.ts` (full file, currently 21 lines)

**Interfaces:**
- Consumes: `jsonwebtoken` (already a dep).
- Produces:
  - `signToken(payload: TokenPayload, expiresIn?: string): string`
  - `verifyToken(token: string): TokenPayload`
  - `refreshToken(token: string): string`
  - `TokenPayload = { accountId: number; uin: string }`

**Design doc reference:** "JWT with jsonwebtoken: symmetric HMAC-SHA256, 24h TTL, secret from JWT_SECRET env"; Risks -> "JWT secret management: env-only, no fallback".

- [ ] **Step 1: Replace auth-module.ts with the env-only version + refresh**

Overwrite `packages/server/src/auth/auth-module.ts`:

```typescript
import jwt from 'jsonwebtoken';

const SECRET_ENV_VAR = 'JWT_SECRET';
const DEFAULT_EXPIRES_IN = '24h';

export interface TokenPayload {
  accountId: number;
  uin: string;
}

function getSecret(): string {
  const secret = process.env[SECRET_ENV_VAR];
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

export function signToken(payload: TokenPayload, expiresIn: string = DEFAULT_EXPIRES_IN): string {
  return jwt.sign(payload, getSecret(), { expiresIn });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, getSecret()) as TokenPayload;
}

export function refreshToken(token: string): string {
  const payload = verifyToken(token);
  return signToken(payload);
}
```

Key changes vs. current: removed `DEFAULT_SECRET` fallback (env-only now per design), added `refreshToken`, made `expiresIn` configurable with a default.

- [ ] **Step 2: Typecheck the server workspace**

Run:
```powershell
npm run typecheck --workspace=@qq-dld/server
```
Expected: PASS. (`auth/index.ts` still exports `createAccountRoutes` from `./routes` and `authMiddleware` from `./middleware`; those files still exist in their old forms, so the build stays green. They are rewritten in later tasks.)

- [ ] **Step 3: Commit**

```powershell
git add packages/server/src/auth/auth-module.ts
git commit -m "feat(auth): env-only JWT secret + refreshToken in AuthModule"
```

---

## Task 3: Auth Middleware (Fastify preHandler)

**Files:**
- Rewrite: `packages/server/src/auth/middleware.ts` (currently Express-style, 25 lines)
- Modify: `packages/server/src/auth/index.ts` (swap export)
- Modify: `packages/server/src/auth/routes.ts` (remove now-broken `authMiddleware` import; body rewritten in Task 7)

**Interfaces:**
- Consumes: `verifyToken`, `TokenPayload` from `./auth-module` (Task 2).
- Produces:
  - `authPreHandler(request: FastifyRequest, reply: FastifyReply): Promise<void>` — a Fastify preHandler hook.
  - Augments `FastifyRequest` with `user?: TokenPayload`.

**Design doc reference:** "AuthMiddleware ... migrates to Fastify preHandler". The runtime is Fastify (`server.ts`), so implement it natively as a Fastify preHandler (not Express). Spec (`auth-login/spec.md`): "extracts and validates the JWT from the Authorization header (Bearer scheme), attaching the decoded payload to `req.user`"; 401 on missing/invalid token.

- [ ] **Step 1: Rewrite middleware.ts as a Fastify preHandler**

Overwrite `packages/server/src/auth/middleware.ts`:

```typescript
import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, type TokenPayload } from './auth-module';

declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

export async function authPreHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'Missing or malformed authorization header' });
    return;
  }
  const token = header.slice(7);
  try {
    request.user = verifyToken(token);
  } catch {
    reply.status(401).send({ error: 'Invalid or expired token' });
  }
}
```

Note: In a Fastify 4 async preHandler, calling `reply.send(...)` and `return` halts the request lifecycle (no `next` callback needed).

- [ ] **Step 2: Update the auth barrel export**

Edit `packages/server/src/auth/index.ts` — replace `authMiddleware` with `authPreHandler` (keep `createAccountRoutes` for now; it is fixed in Task 7):

```typescript
export { signToken, verifyToken, refreshToken } from './auth-module';
export type { TokenPayload } from './auth-module';
export { authPreHandler } from './middleware';
export { AccountService } from './account-service';
export { createAccountRoutes } from './routes';
```

- [ ] **Step 3: Temporarily align auth/routes.ts so the build compiles**

The existing `packages/server/src/auth/routes.ts` imports `{ authMiddleware }` from `./middleware` (now removed) and `{ Router, Request, Response }` from `express`. Since this task removed `authMiddleware`, the build would break. Patch `routes.ts` minimally now (the body is fully rewritten in Task 7):

- Remove the line `import { authMiddleware } from './middleware';` entirely.
- Remove every `authMiddleware,` argument from the `router.post('/logout', ...)`, `router.get('/status', ...)`, `router.get('/', ...)`, `router.post('/', ...)`, and `router.delete('/:id', ...)` calls (leave the Express handlers unguarded — this is dead code replaced in Task 7).

- [ ] **Step 4: Typecheck**

Run:
```powershell
npm run typecheck --workspace=@qq-dld/server
```
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/server/src/auth/middleware.ts packages/server/src/auth/index.ts packages/server/src/auth/routes.ts
git commit -m "refactor(auth): rewrite auth middleware as Fastify preHandler (authPreHandler)"
```

---

## Task 4: Account Service (list / switch / cookies / settings wiring)

**Files:**
- Modify: `packages/server/src/auth/account-service.ts` (currently wraps only `AccountRepo`)

**Interfaces:**
- Consumes: `AccountRepo` (`../data/repositories/account-repo`), `SettingsRepo` (`../data/repositories/settings-repo`), `Account` type (`@qq-dld/shared`). Existing `AccountRepo` methods: `findByUin(uin)`, `create({uin,nickname?,cookies?})`, `update(id, {uin?,nickname?,cookies?,status?})`, `findById(id)`, `findAll()`, `deleteById(id)` (CASCADE via schema). `SettingsRepo`: `get(key, accountId?)`, `set(key, value, accountId?)`.
- Produces (new methods on `AccountService`, in addition to existing `findByUin`/`findById`/`findAll`/`create`/`updateCookies`/`delete`):
  - `list(): PublicAccount[]` — all accounts, **cookies stripped** (spec: "excluding cookie values for security").
  - `toPublic(account: Account): PublicAccount`
  - `updateProfile(id, { nickname?, cookies? }): boolean`
  - `switch(id: number): boolean` — persists `current_account_id` in settings; `false` if account not found.
  - `getActiveAccountId(): number | null`
  - `getCookies(id: number): string | undefined`
  - Type `PublicAccount = Omit<Account, 'cookies'>`.

**Design doc reference:** "AccountService wraps AccountRepo with add/list/remove/switch methods"; "switch-account updates a current-account-id in settings table; CookieManager reads from there". Spec (`account-management/spec.md`): Add (status 'active'), List (exclude cookies), Remove (CASCADE), Store/Retrieve cookies, Switch active account.

- [ ] **Step 1: Add SettingsRepo + new methods to AccountService**

Overwrite `packages/server/src/auth/account-service.ts`:

```typescript
import type { Account } from '@qq-dld/shared';
import { AccountRepo } from '../data/repositories/account-repo';
import { SettingsRepo } from '../data/repositories/settings-repo';
import { DataLayer } from '../data/data-layer';

interface AccountRow {
  id: number;
  uin: string;
  nickname: string;
  cookies: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export type PublicAccount = Omit<Account, 'cookies'>;

const ACTIVE_ACCOUNT_KEY = 'current_account_id';

function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    uin: row.uin,
    nickname: row.nickname,
    cookies: row.cookies,
    status: row.status as Account['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class AccountService {
  private accountRepo: AccountRepo;
  private settingsRepo: SettingsRepo;

  constructor() {
    DataLayer.getInstance();
    this.accountRepo = new AccountRepo();
    this.settingsRepo = new SettingsRepo();
  }

  findByUin(uin: string): Account | undefined {
    return this.accountRepo.findByUin(uin);
  }

  findById(id: number): Account | undefined {
    const row = this.accountRepo.findById(id) as AccountRow | undefined;
    return row ? toAccount(row) : undefined;
  }

  findAll(): Account[] {
    const rows = this.accountRepo.findAll() as AccountRow[];
    return rows.map(toAccount);
  }

  create(data: { uin: string; nickname?: string; cookies?: string }): Account {
    return this.accountRepo.create(data);
  }

  updateCookies(id: number, cookies: string): boolean {
    return this.accountRepo.update(id, { cookies });
  }

  updateProfile(id: number, data: { nickname?: string; cookies?: string }): boolean {
    return this.accountRepo.update(id, data);
  }

  delete(id: number): boolean {
    return this.accountRepo.deleteById(id);
  }

  list(): PublicAccount[] {
    return this.findAll().map((a) => this.toPublic(a));
  }

  toPublic(account: Account): PublicAccount {
    return {
      id: account.id,
      uin: account.uin,
      nickname: account.nickname,
      status: account.status,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  switch(id: number): boolean {
    if (!this.findById(id)) return false;
    this.settingsRepo.set(ACTIVE_ACCOUNT_KEY, String(id));
    return true;
  }

  getActiveAccountId(): number | null {
    const value = this.settingsRepo.get(ACTIVE_ACCOUNT_KEY);
    return value ? parseInt(value, 10) : null;
  }

  getCookies(id: number): string | undefined {
    return this.findById(id)?.cookies;
  }
}
```

Notes:
- `toPublic` builds the object explicitly (no destructure-to-omit) to satisfy `noUnusedLocals`.
- `switch` writes `current_account_id` into the `settings` table (accountId = null, i.e. global setting). `CookieManager` (Task 8) reads the same key.
- `delete` -> `accountRepo.deleteById` -> schema `ON DELETE CASCADE` removes module_configs/exec_logs/friends/task_configs/settings for that account (spec: "account and all associated data ... deleted (CASCADE)").

- [ ] **Step 2: Typecheck**

Run:
```powershell
npm run typecheck --workspace=@qq-dld/server
```
Expected: PASS.

- [ ] **Step 3: Commit**

```powershell
git add packages/server/src/auth/account-service.ts
git commit -m "feat(auth): AccountService list/switch/cookies + settings-backed active account"
```

---

## Task 5: QQ Login Client (hash33, ptqrshow, ptqrlogin, OAuth chain, Set-Cookie)

**Files:**
- Create: `packages/server/src/auth/qq-login-client.ts`
- Create: `packages/server/src/auth/__tests__/qq-login-client.test.ts`

**Interfaces:**
- Consumes: Node 20 global `fetch`, `Buffer`, `URL`.
- Produces:
  - `hash33(s: string): number` — ptqrtoken algorithm.
  - `parsePtuiCB(body: string): CheckStatusResult`
  - `class QqLoginClient`:
    - `getQrCode(jar: Map<string,string>): Promise<{ qrImage: string; qrsig: string }>` — `qrImage` is a `data:image/png;base64,...` data URI.
    - `checkStatus(jar: Map<string,string>, ptqrtoken: number): Promise<CheckStatusResult>`
    - `completeLogin(callbackUrl: string, jar: Map<string,string>, nickname?: string): Promise<CompleteLoginResult>`
  - `CheckStatusResult = { code: number; callbackUrl?: string; nickname?: string }`
  - `CompleteLoginResult = { cookieString: string; uin: string; nickname?: string }`
  - `const qqLoginClient: QqLoginClient` (singleton convenience export).

**Design doc reference:** "QQ Login Client" table; hash33 code; ptqrshow key params; ptqrlogin status codes 66/67/65/0; Login success chain (5 steps); Account Identification (uin from `uin`/`pt2gguin`, strip `o`). Risks: API is undocumented/reverse-engineered; multi-domain Set-Cookie handling.

- [ ] **Step 1: Create qq-login-client.ts**

Create `packages/server/src/auth/qq-login-client.ts`:

```typescript
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
    // 1. Request the OAuth login_jump callback -> graph.qq.com sets domain cookies
    const res1 = await fetch(callbackUrl, {
      headers: { 'User-Agent': DEFAULT_UA, Cookie: cookieHeader(jar) },
      redirect: 'manual',
    });
    mergeCookies(jar, parseSetCookie(res1));

    // 2. Extract the OAuth code from the callback URL query
    const code = new URL(callbackUrl).searchParams.get('code');
    if (!code) {
      throw new Error('OAuth code not found in callback URL');
    }

    // 3. Request the game site with the code -> dld.qzapp.z.qq.com sets session cookies
    const gameUrl = `${GAME_SITE}/index.php?code=${encodeURIComponent(code)}`;
    const res2 = await fetch(gameUrl, {
      headers: { 'User-Agent': DEFAULT_UA, Cookie: cookieHeader(jar) },
      redirect: 'manual',
    });
    mergeCookies(jar, parseSetCookie(res2));

    // 4. Collect game-site cookies + identify the account by uin
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
```

Key technical details encoded (per design doc):
- ptqrshow params exactly `appid=716027609&daid=383&pt_3rd_aid=102067279&e=2&l=M&s=3&d=72&v=4` + random `t`.
- `hash33` = `(hash += (hash << 5) + charCode) & 0x7FFFFFFF` — used as `ptqrtoken`.
- `parsePtuiCB`: extracts status code (1st arg); on `code === 0` extracts callback URL (3rd arg, contains the OAuth `code`) and nickname (6th arg).
- OAuth chain: `login_jump` (graph.qq.com cookies) -> `dld.qzapp.z.qq.com/index.php?code=XXX` (game cookies) — `redirect: 'manual'` so each hop's `Set-Cookie` is captured into the per-session jar.
- uin from `uin` or `pt2gguin` cookie, stripping the leading `o`.
- Set-Cookie parsing via undici `headers.getSetCookie()` (Node 20), with a typed structural cast (no `any`).

- [ ] **Step 2: Create the unit test for hash33 and parsePtuiCB**

Create `packages/server/src/auth/__tests__/qq-login-client.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash33, parsePtuiCB } from '../qq-login-client';

test('hash33 returns a stable 31-bit non-negative value', () => {
  const value = hash33('test-qrsig-value');
  assert.ok(value >= 0, 'hash33 must be non-negative');
  assert.ok(value <= 0x7fffffff, 'hash33 must fit in 31 bits');
  assert.strictEqual(hash33('test-qrsig-value'), value, 'hash33 must be deterministic');
});

test('parsePtuiCB extracts success code, callback URL, and nickname', () => {
  const body =
    `ptuiCB('0',0,'https://graph.qq.com/oauth2.0/login_jump?code=ABC123&state=x',0,'登录成功','Tester');`;
  const result = parsePtuiCB(body);
  assert.strictEqual(result.code, 0);
  assert.strictEqual(
    result.callbackUrl,
    'https://graph.qq.com/oauth2.0/login_jump?code=ABC123&state=x',
  );
  assert.strictEqual(result.nickname, 'Tester');
});

test('parsePtuiCB returns only the code for non-success statuses', () => {
  const body = `ptuiCB('66',0,'',0,'二维码未失效','');`;
  const result = parsePtuiCB(body);
  assert.strictEqual(result.code, 66);
  assert.strictEqual(result.callbackUrl, undefined);
  assert.strictEqual(result.nickname, undefined);
});
```

- [ ] **Step 3: Run the unit test**

Run:
```powershell
node --import tsx --test packages/server/src/auth/__tests__/qq-login-client.test.ts
```
Expected: 3 tests PASS.

- [ ] **Step 4: Typecheck**

Run:
```powershell
npm run typecheck --workspace=@qq-dld/server
```
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/server/src/auth/qq-login-client.ts packages/server/src/auth/__tests__/qq-login-client.test.ts
git commit -m "feat(auth): QQ ptlogin2 HTTP client (hash33, ptqrshow, ptqrlogin, OAuth chain)"
```

---

## Task 6: QR Session Manager

**Files:**
- Create: `packages/server/src/auth/qr-session-manager.ts`

**Interfaces:**
- Consumes: `hash33` from `./qq-login-client` (Task 5); `crypto.randomUUID` (Node 20 built-in).
- Produces:
  - `interface QrSession { id: string; qrsig: string; ptqrtoken: number; cookieJar: Map<string,string>; createdAt: number; status: 'waiting'|'scanned'|'success'|'expired'; uin?: string; nickname?: string }`
  - `class QrSessionManager`:
    - `create(qrsig: string, cookieJar: Map<string,string>): QrSession`
    - `get(id: string): QrSession | undefined`
    - `updateStatus(id, status, patch?: { uin?, nickname? }): void`
    - `remove(id: string): void`
    - `isExpired(session: QrSession): boolean`
    - `dispose(): void` (for tests/shutdown)

**Design doc reference:** "QrSessionManager" — in-memory `Map<sessionId, QrSession>`; the `QrSession` interface (id, qrsig, ptqrtoken, cookieJar, createdAt, status, uin?, nickname?); "Session timeout: 2 minutes ... Expired sessions cleaned up periodically."

- [ ] **Step 1: Create qr-session-manager.ts**

Create `packages/server/src/auth/qr-session-manager.ts`:

```typescript
import { randomUUID } from 'node:crypto';
import { hash33 } from './qq-login-client';

export interface QrSession {
  id: string;
  qrsig: string;
  ptqrtoken: number;
  cookieJar: Map<string, string>;
  createdAt: number;
  status: 'waiting' | 'scanned' | 'success' | 'expired';
  uin?: string;
  nickname?: string;
}

const SESSION_TTL_MS = 2 * 60 * 1000; // 2 minutes (QQ QR code expiry)
const CLEANUP_INTERVAL_MS = 30 * 1000;

export class QrSessionManager {
  private sessions = new Map<string, QrSession>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  create(qrsig: string, cookieJar: Map<string, string>): QrSession {
    const session: QrSession = {
      id: randomUUID(),
      qrsig,
      ptqrtoken: hash33(qrsig),
      cookieJar,
      createdAt: Date.now(),
      status: 'waiting',
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): QrSession | undefined {
    return this.sessions.get(id);
  }

  updateStatus(
    id: string,
    status: QrSession['status'],
    patch?: { uin?: string; nickname?: string },
  ): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.status = status;
    if (patch?.uin !== undefined) session.uin = patch.uin;
    if (patch?.nickname !== undefined) session.nickname = patch.nickname;
  }

  remove(id: string): void {
    this.sessions.delete(id);
  }

  isExpired(session: QrSession): boolean {
    return Date.now() - session.createdAt > SESSION_TTL_MS;
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [id, session] of this.sessions) {
        if (now - session.createdAt > SESSION_TTL_MS) {
          this.sessions.delete(id);
        }
      }
    }, CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.sessions.clear();
  }
}
```

Notes: `create` takes the `cookieJar` already populated by `getQrCode` (Task 7 wires the order) and derives `ptqrtoken` via `hash33(qrsig)`. The cleanup interval is `unref()`-ed so it never keeps the process alive.

- [ ] **Step 2: Typecheck**

Run:
```powershell
npm run typecheck --workspace=@qq-dld/server
```
Expected: PASS.

- [ ] **Step 3: Commit**

```powershell
git add packages/server/src/auth/qr-session-manager.ts
git commit -m "feat(auth): QrSessionManager with 2-min TTL and periodic cleanup"
```

---

## Task 7: API Routes (qr/start, qr/status, logout, accounts sanitize) + Server Wiring

**Files:**
- Rewrite: `packages/server/src/auth/routes.ts` (currently Express-style dead code)
- Modify: `packages/server/src/routes/accounts.ts` (sanitize GET list)
- Delete: `packages/server/src/routes/auth.ts` (old uin-based `/api/auth/login`)
- Modify: `packages/server/src/server.ts` (import new `authRoutes`, use `authPreHandler`, expand public-route set, remove `@fastify/jwt`, add `JWT_SECRET` guard + bootstrap)
- Modify: `packages/server/src/auth/index.ts` (export `authRoutes` not `createAccountRoutes`)
- Modify: `packages/server/package.json` (add `start` script; remove `@fastify/jwt` + `@types/express`)

**Interfaces:**
- Consumes: `signToken` (Task 2), `AccountService` (Task 4), `QrSessionManager` (Task 6), `QqLoginClient` (Task 5), `authPreHandler` (Task 3), `FastifyPluginAsync`.
- Produces:
  - `POST /api/auth/qr/start` -> `{ sessionId: string; qrImage: string }` (public, no auth)
  - `GET /api/auth/qr/status?id=<sessionId>` -> `{ status: 'waiting'|'scanned'|'expired' }` or `{ status: 'success'; token: string; account: PublicAccount }` (public)
  - `POST /api/auth/logout` -> `{ success: true }` (auth-guarded)
  - `GET /api/accounts` -> `{ accounts: PublicAccount[] }` (auth-guarded, cookies stripped)
  - `DELETE /api/accounts/:id` -> `{ success: true }` (auth-guarded; already existed)
  - Server starts via `npm run start --workspace=@qq-dld/server` (`tsx src/server.ts`).

**Design doc reference:** Data flow diagram (Frontend -> `/qr/start` -> ptqrshow -> `{sessionId, qrImage}`; `/qr/status` poll -> ptqrlogin -> status; success -> OAuth chain -> game cookies -> uin -> JWT -> `{token, account}`); Account Identification (findByUin -> updateCookies or create; sign JWT `{accountId, uin}`).

- [ ] **Step 1: Rewrite auth/routes.ts as a Fastify plugin**

Overwrite `packages/server/src/auth/routes.ts`:

```typescript
import { FastifyPluginAsync } from 'fastify';
import { signToken } from './auth-module';
import { AccountService } from './account-service';
import { QrSessionManager } from './qr-session-manager';
import { QqLoginClient } from './qq-login-client';

const sessionManager = new QrSessionManager();
const qqClient = new QqLoginClient();
const accountService = new AccountService();

export const authRoutes: FastifyPluginAsync = async (server) => {
  server.post('/api/auth/qr/start', async (_request, reply) => {
    try {
      const cookieJar = new Map<string, string>();
      const { qrImage, qrsig } = await qqClient.getQrCode(cookieJar);
      const session = sessionManager.create(qrsig, cookieJar);
      reply.send({ sessionId: session.id, qrImage });
    } catch (error) {
      reply
        .status(502)
        .send({ error: 'Failed to fetch QR code', detail: String(error) });
    }
  });

  server.get('/api/auth/qr/status', async (request, reply) => {
    const { id } = request.query as { id?: string };
    if (!id) {
      reply.status(400).send({ error: 'id is required' });
      return;
    }
    const session = sessionManager.get(id);
    if (!session) {
      reply.status(404).send({ error: 'Session not found' });
      return;
    }
    if (session.status === 'expired' || sessionManager.isExpired(session)) {
      sessionManager.updateStatus(id, 'expired');
      reply.send({ status: 'expired' });
      return;
    }
    if (session.status === 'success') {
      reply.send({ status: 'success' });
      return;
    }

    try {
      const result = await qqClient.checkStatus(session.cookieJar, session.ptqrtoken);

      if (result.code === 66) {
        reply.send({ status: 'waiting' });
        return;
      }
      if (result.code === 67) {
        sessionManager.updateStatus(id, 'scanned');
        reply.send({ status: 'scanned' });
        return;
      }
      if (result.code === 65) {
        sessionManager.updateStatus(id, 'expired');
        reply.send({ status: 'expired' });
        return;
      }

      // code === 0 -> login success: complete OAuth chain, upsert account, sign JWT
      if (result.code === 0 && result.callbackUrl) {
        const login = await qqClient.completeLogin(
          result.callbackUrl,
          session.cookieJar,
          result.nickname,
        );

        let account = accountService.findByUin(login.uin);
        if (account) {
          accountService.updateProfile(account.id, {
            cookies: login.cookieString,
            nickname: login.nickname,
          });
          account = accountService.findById(account.id);
        } else {
          account = accountService.create({
            uin: login.uin,
            nickname: login.nickname,
            cookies: login.cookieString,
          });
        }
        if (!account) {
          reply.status(500).send({ error: 'Account persistence failed' });
          return;
        }

        const token = signToken({ accountId: account.id, uin: account.uin });
        accountService.switch(account.id);
        sessionManager.updateStatus(id, 'success', {
          uin: login.uin,
          nickname: login.nickname,
        });

        reply.send({ status: 'success', token, account: accountService.toPublic(account) });
        return;
      }

      // Unknown code -> keep waiting
      reply.send({ status: 'waiting' });
    } catch (error) {
      reply
        .status(502)
        .send({ error: 'Status check failed', detail: String(error) });
    }
  });

  server.post('/api/auth/logout', async (_request, reply) => {
    reply.send({ success: true });
  });
};
```

Notes on the login-success flow (spec scenario "Login Success"):
1. `checkStatus` returns `code === 0` with `callbackUrl` + `nickname`.
2. `completeLogin` walks the OAuth chain and returns `{ cookieString, uin, nickname }`.
3. `accountService.findByUin(uin)` -> exists: `updateProfile` (cookies + nickname) — **not duplicated**; absent: `create({ uin, nickname, cookies })`.
4. `signToken({ accountId, uin })` -> JWT.
5. `accountService.switch(account.id)` -> sets active account.
6. Returns `{ status: 'success', token, account: PublicAccount }` (cookies stripped via `toPublic`).

- [ ] **Step 2: Update the auth barrel export**

Edit `packages/server/src/auth/index.ts` — replace the `createAccountRoutes` line with the new `authRoutes` export:

```typescript
export { signToken, verifyToken, refreshToken } from './auth-module';
export type { TokenPayload } from './auth-module';
export { authPreHandler } from './middleware';
export { AccountService } from './account-service';
export type { PublicAccount } from './account-service';
export { authRoutes } from './routes';
```

- [ ] **Step 3: Sanitize the GET /api/accounts list**

Edit `packages/server/src/routes/accounts.ts` — change the GET handler to return `accountService.list()` (cookies stripped) instead of `findAll()`:

Replace:
```typescript
  server.get('/api/accounts', async (_request, reply) => {
    const accounts = accountService.findAll();
    reply.send({ accounts });
  });
```
with:
```typescript
  server.get('/api/accounts', async (_request, reply) => {
    const accounts = accountService.list();
    reply.send({ accounts });
  });
```
(Leave the POST and DELETE handlers as-is — they are auth-guarded by the global hook and already satisfy the Add/Remove scenarios. POST creates with status defaulting to `'active'` via the schema; DELETE cascades.)

- [ ] **Step 4: Delete the old uin-based auth route**

Run:
```powershell
git rm packages/server/src/routes/auth.ts
```

- [ ] **Step 5: Rewire server.ts**

Overwrite `packages/server/src/server.ts`:

```typescript
import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import { authPreHandler } from './auth/middleware';
import { authRoutes } from './auth/routes';
import { statusRoutes } from './routes/status';
import { accountRoutes } from './routes/accounts';
import { logRoutes } from './routes/logs';
import { moduleRoutes } from './routes/modules';
import { schedulerRoutes } from './routes/scheduler';
import { settingRoutes } from './routes/settings';
import { DataLayer } from './data/data-layer';

const PUBLIC_ROUTES = new Set<string>([
  '/api/status',
  '/api/auth/qr/start',
  '/api/auth/qr/status',
]);

export async function buildServer(): Promise<FastifyInstance> {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  DataLayer.initialize();

  const server = Fastify({ logger: true });

  await server.register(cors, { origin: true });
  await server.register(formbody);

  server.addHook('onRoute', (routeOptions) => {
    if (routeOptions.url && !PUBLIC_ROUTES.has(routeOptions.url)) {
      const preHandler = routeOptions.preHandler;
      routeOptions.preHandler = Array.isArray(preHandler)
        ? [authPreHandler, ...preHandler]
        : [authPreHandler];
    }
  });

  await server.register(statusRoutes);
  await server.register(authRoutes);
  await server.register(accountRoutes);
  await server.register(logRoutes);
  await server.register(moduleRoutes);
  await server.register(schedulerRoutes);
  await server.register(settingRoutes);

  server.setErrorHandler((error: Error & { statusCode?: number }, _request: FastifyRequest, reply: FastifyReply) => {
    reply.status(error.statusCode || 500).send({
      success: false,
      error: error.message || 'Internal Server Error',
    });
  });

  return server;
}

export async function startServer(): Promise<FastifyInstance> {
  const server = await buildServer();
  const port = parseInt(process.env.PORT || '3001', 10);
  await server.listen({ port, host: '0.0.0.0' });
  console.log(`Fastify server listening on port ${port}`);
  return server;
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

Key changes vs. current `server.ts`:
- Removed `import jwt from '@fastify/jwt'` and `await server.register(jwt, ...)` — `AuthModule` (jsonwebtoken) is now the single JWT authority (Task 2).
- Removed the local `JWT_SECRET` fallback const + inline `authHook`; replaced the onRoute guard with `authPreHandler` (Task 3) and the `PUBLIC_ROUTES` set now includes the QR routes (so they are not auth-guarded) and drops the removed `/api/auth/login`.
- `import { authRoutes } from './auth/routes'` (the new QR plugin) instead of the deleted `./routes/auth`.
- Added the startup `JWT_SECRET` guard (env-only, no fallback — design doc risk note) and a `require.main === module` bootstrap so the server can be started directly.

- [ ] **Step 6: Add a start script to packages/server/package.json**

Edit `packages/server/package.json` — add a `start` script to the `scripts` block (after `typecheck`):

```json
    "typecheck": "tsc -b --noEmit",
    "start": "tsx src/server.ts",
    "test": "node --import tsx --test src/data/__tests__/data-layer.test.ts"
```

- [ ] **Step 7: Remove now-unused deps (@fastify/jwt + @types/express)**

After Step 5, no file imports `@fastify/jwt` or `express`/`@types/express`. Edit `packages/server/package.json`:
- From `dependencies`, remove the `"@fastify/jwt": "^10.2.0",` line.
- From `devDependencies`, remove the `"@types/express": "^5.0.6",` line.

Then refresh the lockfile:
```powershell
npm install
```

- [ ] **Step 8: Verify no lingering importers of the removed modules/routes**

Run:
```powershell
npm run typecheck --workspace=@qq-dld/server
```
Expected: PASS.

Also grep to confirm nothing else imported the deleted route or removed symbols (use the Grep tool):
- `createAccountRoutes` over `packages/server/src/**/*.ts` — expect no matches (only re-exported by `auth/index.ts`, fixed in Step 2).
- `routes/auth` over `packages/server/src/**/*.ts` — expect no matches (only `server.ts`, fixed in Step 5).
- `@fastify/jwt` over `packages/server/src/**/*.ts` — expect no matches.
- `from 'express'` over `packages/server/src/**/*.ts` — expect no matches.

- [ ] **Step 9: Build the whole monorepo to confirm everything compiles**

Run:
```powershell
npm run build
```
Expected: PASS (shared -> server -> web all build).

- [ ] **Step 10: Commit**

```powershell
git add packages/server/src/auth/routes.ts packages/server/src/auth/index.ts packages/server/src/routes/accounts.ts packages/server/src/server.ts packages/server/package.json package-lock.json
git commit -m "feat(auth): QR login routes (qr/start, qr/status, logout) + Fastify server wiring"
```
(The `git rm` of `routes/auth.ts` from Step 4 is already staged.)

---

## Task 8: Cookie Manager (per-account cookie isolation + switch)

**Files:**
- Modify: `packages/server/src/gateway/cookie-manager.ts` (currently has `getCookie`/`setCookie`/`hasCookie` by accountId)

**Interfaces:**
- Consumes: `AccountRepo` (`../data/repositories/account-repo`), `SettingsRepo` (`../data/repositories/settings-repo`), `DataLayer`. Reads the same `current_account_id` settings key written by `AccountService.switch` (Task 4).
- Produces (new methods, alongside existing `getCookie`/`setCookie`/`hasCookie`):
  - `switchAccount(accountId: number): boolean` — sets `current_account_id`; `false` if account not found.
  - `getActiveAccountId(): number | null`
  - `getActiveCookies(): string | undefined` — cookies for the active account.
  - `getCookieHeader(accountId?: number): string` — `accountId` overrides active; returns the `name=value; ...` string the game request layer injects as the `Cookie` header.

**Design doc reference:** "Cookie isolation: cookies stored in accounts table; switch-account updates a current-account-id in settings table; CookieManager reads from there". Spec (`account-management/spec.md`): "Switch Active Account" -> active id persisted; "the selected account's cookies are used for game API requests".

- [ ] **Step 1: Extend CookieManager with active-account support**

Overwrite `packages/server/src/gateway/cookie-manager.ts`:

```typescript
import { AccountRepo } from '../data/repositories/account-repo';
import { SettingsRepo } from '../data/repositories/settings-repo';
import { DataLayer } from '../data/data-layer';

const ACTIVE_ACCOUNT_KEY = 'current_account_id';

export class CookieManager {
  private accountRepo: AccountRepo;
  private settingsRepo: SettingsRepo;

  constructor() {
    DataLayer.getInstance();
    this.accountRepo = new AccountRepo();
    this.settingsRepo = new SettingsRepo();
  }

  getCookie(accountId: number): string | undefined {
    return this.accountRepo.findById(accountId)?.cookies;
  }

  setCookie(accountId: number, cookies: string): void {
    this.accountRepo.update(accountId, { cookies });
  }

  hasCookie(accountId: number): boolean {
    return !!this.getCookie(accountId);
  }

  switchAccount(accountId: number): boolean {
    if (!this.accountRepo.findById(accountId)) return false;
    this.settingsRepo.set(ACTIVE_ACCOUNT_KEY, String(accountId));
    return true;
  }

  getActiveAccountId(): number | null {
    const value = this.settingsRepo.get(ACTIVE_ACCOUNT_KEY);
    return value ? parseInt(value, 10) : null;
  }

  getActiveCookies(): string | undefined {
    const id = this.getActiveAccountId();
    return id !== null ? this.getCookie(id) : undefined;
  }

  getCookieHeader(accountId?: number): string {
    const id = accountId ?? this.getActiveAccountId();
    if (id === null) return '';
    return this.getCookie(id) ?? '';
  }
}
```

Notes:
- `switchAccount` and `AccountService.switch` (Task 4) write the same `current_account_id` settings key; either may be used to change the active account. The QR login success flow (Task 7) already calls `accountService.switch`, so a freshly logged-in account becomes the active one automatically.
- **Injection contract (task 8.2):** the game request layer (the TS game client migrated in change 4) consumes `cookieManager.getActiveCookies()` / `getCookieHeader()` to populate the `Cookie` header on every game API call. The legacy CommonJS `src/gateway/game-client.js` is out of scope. This task delivers the CookieManager API that the request layer will call; no TS game client exists in `packages/server` yet, so there is no call-site to wire here.

- [ ] **Step 2: Typecheck**

Run:
```powershell
npm run typecheck --workspace=@qq-dld/server
```
Expected: PASS.

- [ ] **Step 3: Commit**

```powershell
git add packages/server/src/gateway/cookie-manager.ts
git commit -m "feat(auth): CookieManager active-account switching + cookie header contract"
```

---

## Task 9: Frontend (Login.vue)

**Files:**
- Rewrite: `packages/web/src/pages/Login.vue` (currently a placeholder that calls the old `/api/auth/login`)

**Interfaces:**
- Consumes: `http` from `../api/http` (axios instance, baseURL `http://localhost:3001`, Bearer interceptor, 401 -> redirect `#/login`); `useRouter` from `vue-router`; Vant `van-image`, `van-notice-bar`, `van-button`, `van-empty` (all registered in `main.ts`).
- Produces: a login page that auto-starts QR login on mount and polls `/qr/status` every 2s.

**Design doc reference:** "Frontend (Login.vue)" — Enter page -> auto-call `/qr/start` -> display QR; poll `/qr/status` (2s); status mapping (waiting -> "请用QQ扫码" / scanned -> "请在手机确认登录" / success -> store token+account, redirect to `/modules` / expired -> refresh button).

- [ ] **Step 1: Rewrite Login.vue**

Overwrite `packages/web/src/pages/Login.vue`:

```vue
<template>
  <div class="login-page">
    <van-image v-if="qrImage" :src="qrImage" width="220" height="220" />
    <van-notice-bar v-if="status === 'waiting'" text="请使用 QQ 扫描上方二维码" />
    <van-notice-bar v-else-if="status === 'scanned'" text="请在手机上确认登录" />
    <van-notice-bar v-else-if="status === 'expired'" text="二维码已过期，请刷新" />
    <van-button
      v-if="status === 'expired'"
      type="primary"
      @click="startQrLogin"
    >刷新二维码</van-button>
    <van-empty v-if="error" :description="error" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import http from '../api/http';

type QrStatus = 'waiting' | 'scanned' | 'success' | 'expired';

const router = useRouter();
const qrImage = ref('');
const status = ref<QrStatus>('waiting');
const error = ref('');
let pollTimer: ReturnType<typeof setInterval> | null = null;
let sessionId = '';

async function startQrLogin(): Promise<void> {
  stopPolling();
  qrImage.value = '';
  status.value = 'waiting';
  error.value = '';
  try {
    const res = await http.post('/api/auth/qr/start');
    sessionId = res.data.sessionId;
    qrImage.value = res.data.qrImage;
    startPolling();
  } catch {
    error.value = '获取二维码失败，请重试';
  }
}

function startPolling(): void {
  pollTimer = setInterval(pollStatus, 2000);
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollStatus(): Promise<void> {
  try {
    const res = await http.get('/api/auth/qr/status', { params: { id: sessionId } });
    const data = res.data as { status: QrStatus; token?: string; account?: unknown };
    status.value = data.status;
    if (data.status === 'success' && data.token) {
      stopPolling();
      localStorage.setItem('token', data.token);
      localStorage.setItem('account', JSON.stringify(data.account));
      router.push('/modules');
    } else if (data.status === 'expired') {
      stopPolling();
    }
  } catch {
    // keep polling on transient network errors
  }
}

onMounted(startQrLogin);
onUnmounted(stopPolling);
</script>
```

Notes:
- `http.ts` already attaches `Authorization: Bearer <token>` from `localStorage` and redirects to `#/login` on 401. The QR endpoints are public (no auth), so no 401 during login.
- On success, the token + sanitized account are stored in `localStorage` (matching the existing `Accounts.vue` / `http.ts` contract), then the user is redirected to `/modules` (route already defined in `packages/web/src/router/index.ts`).
- The `expired` status stops polling and reveals a "刷新二维码" button that re-runs `startQrLogin` (a fresh `qrsig`/session).
- Polling interval is cleared `onUnmounted` to avoid leaks.

- [ ] **Step 2: Typecheck + build the web workspace**

Run:
```powershell
npm run build --workspace=@qq-dld/web
```
Expected: PASS (vue-tsc + vite build). If the workspace has a separate `typecheck` script, run that too.

- [ ] **Step 3: Commit**

```powershell
git add packages/web/src/pages/Login.vue
git commit -m "feat(web): QR login page with auto-start, 2s polling, and expired refresh"
```

---

## Task 10: Build & Verification

**Files:** none (verification only).

**Design doc reference:** "Acceptance Verification" checklist.

- [ ] **Step 1: tsc --build passes (server)**

Run:
```powershell
npm run build --workspace=@qq-dld/server
```
Expected: PASS (tasks.md 10.1).

- [ ] **Step 2: npm run build passes (all workspaces)**

Run:
```powershell
npm run build
```
Expected: PASS — shared, server, web all build (tasks.md 10.2).

- [ ] **Step 3: npm run typecheck passes**

Run:
```powershell
npm run typecheck
```
Expected: PASS (tasks.md 10.3).

- [ ] **Step 4: Start the server with JWT_SECRET set**

Run (PowerShell):
```powershell
$env:JWT_SECRET="test-secret-for-verification"
npm run start --workspace=@qq-dld/server
```
Expected: console prints `Fastify server listening on port 3001`. (If port 3001 is in use, set `$env:PORT="3099"` first.) Keep this running for Steps 5-7.

- [ ] **Step 5: Verify POST /api/auth/qr/start returns a QR image**

In a second terminal:
```powershell
$resp = Invoke-RestMethod -Method Post -Uri http://localhost:3001/api/auth/qr/start
$resp.sessionId  # a UUID
$resp.qrImage    # starts with "data:image/png;base64,"
```
Expected: a `sessionId` (UUID) and a `qrImage` data URI containing a valid base64 PNG (design doc acceptance #1). Save the `sessionId` for Step 6.

- [ ] **Step 6: Verify GET /api/auth/qr/status returns waiting/scanned/expired**

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:3001/api/auth/qr/status?id=$($resp.sessionId)"
```
Expected (before scanning): `{ status: "waiting" }`. After scanning with a QQ mobile app: `{ status: "scanned" }`. After confirming on mobile: `{ status: "success", token: "...", account: {...} }` — the `account` object has NO `cookies` field (design doc acceptance #2, #3; spec "Login Success").

- [ ] **Step 7: Verify a protected route requires the Bearer token**

Without a token:
```powershell
try { Invoke-RestMethod -Method Get -Uri http://localhost:3001/api/accounts } catch { $_.Exception.Response.StatusCode.value__ }
```
Expected: `401` (spec "Missing Token").

With the token from Step 6:
```powershell
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Method Get -Uri http://localhost:3001/api/accounts -Headers $headers
```
Expected: `200` with `{ accounts: [...] }`; each account object has NO `cookies` field (spec "Protected Route Access" + "List Accounts" excludes cookies; design doc acceptance #5, #6, #7).

- [ ] **Step 8: Verify same-QQ re-scan updates the existing account (no duplicate)**

Scan the same QQ number a second time (new `/qr/start` + scan + confirm), then:
```powershell
Invoke-RestMethod -Method Get -Uri http://localhost:3001/api/accounts -Headers $headers
```
Expected: the count of accounts with that `uin` is still **1** (cookies/nickname updated, not duplicated) — design doc acceptance #4; spec "Existing Account Re-login".

- [ ] **Step 9: Verify account add/list/remove via API**

```powershell
# add (admin) — uses POST /api/accounts
$created = Invoke-RestMethod -Method Post -Uri http://localhost:3001/api/accounts -Headers $headers -Body (@{uin="999000999"} | ConvertTo-Json) -ContentType "application/json"
# list
Invoke-RestMethod -Method Get -Uri http://localhost:3001/api/accounts -Headers $headers
# remove (CASCADE)
Invoke-RestMethod -Method Delete -Uri "http://localhost:3001/api/accounts/$($created.account.id)" -Headers $headers
```
Expected: add returns `201` with `account.status === 'active'`; list excludes cookies; remove returns `{ success: true }` and the account is gone (spec Add/List/Remove scenarios; design doc acceptance #7).

- [ ] **Step 10: Verify cookie switch between accounts works**

Using two accounts (A and B) created via QR login, call the switch flow. Since there is no TS game client yet, verify at the data layer:
```powershell
# After logging into account A then B, both exist; B is active (last switch).
# Confirm active account id is persisted in settings:
Invoke-RestMethod -Method Get -Uri http://localhost:3001/api/settings -Headers $headers
```
Expected: the `settings` table contains a row `key=current_account_id` with the value of the last-logged-in account's id (spec "Switch Active Account"). The `CookieManager.getActiveAccountId()` reads this same row (Task 8).

- [ ] **Step 11: Stop the server and commit any remaining verification artifacts**

Stop the server (Ctrl+C in its terminal). No code changes in this task, so there is nothing to commit unless verification surfaced a fix — in that case, make a focused commit with `fix(auth): ...`.

---

## Self-Review

**1. Spec coverage** — `auth-login/spec.md` + `account-management/spec.md` vs. tasks:

- JWT Token Signing (sign/verify; expired & invalid-signature rejection) -> Task 2 (`verifyToken` throws on expired/invalid -> Task 3 `authPreHandler` returns 401). ✓
- Auth Middleware (Bearer extraction, `req.user`, 401 missing/invalid) -> Task 3. ✓
- QR Login Session Management (concurrent sessions, unique id, independent qrsig/cookie jar, no browser; 2-min expiry) -> Tasks 5, 6, 7 (`QrSessionManager` in-memory Map, per-session `cookieJar`, `isExpired`/cleanup; `QqLoginClient` HTTP-only). ✓
- QR Login Status Polling (ptqrtoken=hash33(qrsig); codes 66/67/65/0; success -> OAuth chain -> uin -> JWT -> `{status, token, account}`) -> Tasks 5, 6, 7. ✓
- Account Auto-Identification (uin from `uin`/`pt2gguin`, strip `o`; new vs. existing) -> Task 5 (`extractUin`) + Task 7 (findByUin -> updateProfile vs. create). ✓
- Account CRUD (add status 'active'; list excludes cookies; remove CASCADE) -> Task 4 (`list`/`toPublic`/`delete`) + Task 7 (accounts route sanitize) + schema CASCADE. ✓
- Cookie Persistence (store/retrieve; switch active -> settings; active account's cookies used) -> Tasks 4, 8 (`updateCookies`/`getCookies`/`switch`/`switchAccount`/`getActiveCookies`). ✓
- tasks.md 1.x-10.x sections -> Tasks 1-10 above, in order. ✓

**2. Placeholder scan** — no "TBD"/"TODO"/"implement later"; every code step shows the full code; verification steps show exact commands + expected output. ✓

**3. Type consistency** — cross-task names:
- `signToken` / `verifyToken` / `refreshToken` / `TokenPayload` (Task 2) used unchanged in Tasks 3, 7. ✓
- `authPreHandler` (Task 3) used in Task 7 `server.ts`. ✓
- `AccountService.list` / `toPublic` / `updateProfile` / `switch` / `getActiveAccountId` / `getCookies` / `PublicAccount` (Task 4) used in Tasks 7, 8, 9. ✓
- `hash33` / `parsePtuiCB` / `QqLoginClient` / `CheckStatusResult` / `CompleteLoginResult` / `qqLoginClient` (Task 5) used in Tasks 6, 7. ✓
- `QrSession` / `QrSessionManager` (Task 6) used in Task 7. ✓
- `authRoutes` (Task 7) used in `server.ts`; `createAccountRoutes` removed everywhere. ✓
- `CookieManager.switchAccount` / `getActiveAccountId` / `getActiveCookies` / `getCookieHeader` (Task 8). ✓
- Settings key `current_account_id` is identical in Task 4 (`AccountService.switch`) and Task 8 (`CookieManager`). ✓

No gaps or name drifts found.
