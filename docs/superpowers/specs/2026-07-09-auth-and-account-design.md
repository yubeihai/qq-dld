---
comet_change: auth-and-account
role: technical-design
canonical_spec: openspec
---

# Auth and Account Management — Technical Design

## Context

This change adds JWT auth + multi-account management to qq-dld. It builds on the data layer (change 2) and prepares for Fastify route migration (change 4).

## Implementation Approach

### AuthModule

```
packages/server/src/auth/
├── auth-module.ts         # sign() / verify() / refresh()
├── middleware.ts          # Express-compatible auth middleware
├── account-service.ts     # Account CRUD + cookie management
├── qr-session-manager.ts  # Concurrent QR session management (in-memory Map)
├── qq-login-client.ts     # QQ ptlogin2 HTTP client (ptqrshow/ptqrlogin/OAuth)
├── routes.ts              # Express router for auth endpoints
└── index.ts               # barrel exports
```

### Key Design Decisions

1. **JWT with jsonwebtoken**: symmetric HMAC-SHA256, 24h TTL, secret from JWT_SECRET env
2. **AuthMiddleware**: Express (req, res, next) style — compatible with existing Express routes; migrates to Fastify preHandler in change 4
3. **AccountService**: wraps AccountRepo (from change 2) with add/list/remove/switch methods
4. **Cookie isolation**: cookies stored in accounts table; switch-account updates a current-account-id in settings table; CookieManager reads from there
5. **Login flow (HTTP-based QR login, Scheme A)**: No browser/puppeteer dependency. Backend calls QQ ptlogin2 HTTP APIs directly — see QR Login Flow section below

### QR Login Flow (HTTP-based, Scheme A)

Replaces the original puppeteer-core approach. No browser dependency, supports concurrent multi-account login.

#### Data Flow

```
Frontend (Login.vue)     Backend (Fastify)          QQ ptlogin2
    │                        │                          │
    │ POST /qr/start         │                          │
    │───────────────────────>│ GET ptqrshow             │
    │                        │─────────────────────────>│
    │                        │<── QR PNG + qrsig cookie──│
    │<── {sessionId,         │                          │
    │     qrImage(base64)}   │                          │
    │                        │                          │
    │ GET /qr/status?id=X    │ GET ptqrlogin (poll)     │
    │───────────────────────>│─────────────────────────>│
    │                        │<── ptuiCB(status code)────│
    │<── {status, nickname}  │                          │
    │                        │                          │
    │ (status=success)       │ extract OAuth code        │
    │                        │ GET login_jump            │
    │                        │─────────────────────────>│
    │                        │ GET dld.../index.php?code=│
    │                        │─────────────────────────>│
    │                        │<── game-site cookies──────│
    │<── {token, account}    │                          │
```

1. Frontend → `POST /api/auth/qr/start` → Backend requests `ptqrshow` → returns `{sessionId, qrImage}`
2. Frontend → `GET /api/auth/qr/status?id=X` (2s poll) → Backend polls `ptqrlogin` → returns `{status, nickname?}`
3. On success: Backend completes OAuth chain → collects `dld.qzapp.z.qq.com` cookies → identifies account by uin → signs JWT → returns `{token, account}`

#### QrSessionManager

In-memory `Map<sessionId, QrSession>` for concurrent sessions.

```typescript
interface QrSession {
  id: string;           // UUID
  qrsig: string;        // from ptqrshow Set-Cookie
  ptqrtoken: number;    // hash33(qrsig)
  cookieJar: Map<string, string>;  // per-session cookies
  createdAt: number;
  status: 'waiting' | 'scanned' | 'success' | 'expired';
  uin?: string;
  nickname?: string;
}
```

Session timeout: 2 minutes (QR code expiry enforced by QQ). Expired sessions cleaned up periodically.

#### QQ Login Client

| Method | QQ API | Purpose |
|--------|--------|---------|
| `getQrCode()` | `ssl.ptlogin2.qq.com/ptqrshow` | Fetch QR PNG + qrsig cookie |
| `checkStatus(qrsig, ptqrtoken)` | `ssl.ptlogin2.qq.com/ptqrlogin` | Poll scan status, parse ptuiCB |
| `completeLogin(callbackUrl, cookieJar)` | `graph.qq.com` → `dld.qzapp.z.qq.com` | OAuth code → game site cookies |

**ptqrtoken calculation (hash33)**:
```typescript
function hash33(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash += (hash << 5) + s.charCodeAt(i);
  }
  return hash & 0x7FFFFFFF;
}
```

**ptqrshow key params**: `appid=716027609&daid=383&pt_3rd_aid=102067279&e=2&l=M&s=3&d=72&v=4&t=<random>`

**ptqrlogin status codes**:

| Code | Meaning |
|------|---------|
| 66 | Not scanned |
| 67 | Scanned, awaiting confirmation |
| 65 | QR code expired |
| 0 | Login success (ptuiCB 4th param = 0) |

**Login success chain**:
1. ptqrlogin returns `ptuiCB('0',0,'https://graph.qq.com/oauth2.0/login_jump?code=XXX&...',0,'登录成功','NICKNAME')`
2. Regex extract callback URL (contains OAuth code) and nickname
3. Request callback URL with session cookies → graph.qq.com sets domain cookies
4. Request `https://dld.qzapp.z.qq.com/index.php?code=XXX` → game site sets session cookies
5. Collect `dld.qzapp.z.qq.com` domain cookies (p_skey, skey, uin, pt4_token, pt2gguin, etc.)

#### Account Identification

On login success, extract uin from cookies (`uin` or `pt2gguin` cookie, strip `o` prefix):
- `AccountService.findByUin(uin)` → exists: `updateCookies(id, cookieString)` / not exists: `create({uin, nickname, cookies})`
- Sign JWT `{accountId, uin}` → return to frontend

Same QQ number re-scan → existing account updated (not duplicated). Different QQ number → new account created.

#### Frontend (Login.vue)

- Enter page → auto-call `/qr/start` → display QR image (`<img :src="qrImage">`)
- Poll `/qr/status` (2s interval)
- Status mapping: `waiting` → show QR + "请用QQ扫码" / `scanned` → "请在手机确认登录" / `success` → store token+account, redirect to `/modules` / `expired` → show refresh button

#### Dependencies

- Node 20+ built-in `fetch` (undici) + manual `Set-Cookie` header parsing
- No puppeteer-core, no axios needed for login
- Remove puppeteer-core from packages/server deps if present

## Implementation Divergence

### D3: Express → Fastify Native

The design doc originally specified Express-compatible middleware (`(req, res, next)` style) with the assumption that Fastify migration was a future change (change 4). During implementation, it was discovered that the project already uses Fastify as its HTTP server (`packages/server/src/server.ts` imports Fastify, not Express). The middleware was therefore implemented as a Fastify `preHandler` (`authPreHandler`) and routes as Fastify plugins (`authRoutes`, `accountRoutes`). This eliminates the Express→Fastify migration debt entirely and is the correct approach for the current project state. The `@fastify/jwt` dependency was also removed in favor of the standalone `AuthModule` as the sole JWT authority.

## Risks

- QQ ptlogin2 API is undocumented and may change — ptqrtoken hash33 algorithm and ptuiCB format are reverse-engineered
- Cookie jar management across multiple QQ domains (ssl.ptlogin2.qq.com, graph.qq.com, dld.qzapp.z.qq.com) requires careful Set-Cookie handling
- QR code expiry (2 min) — frontend must handle expired state and allow refresh
- JWT secret management: env-only, no fallback

## Acceptance Verification

- POST /api/auth/qr/start → returns {sessionId, qrImage} with valid base64 PNG
- GET /api/auth/qr/status → returns correct status (waiting/scanned/success/expired)
- QR scan success → game-site cookies collected → account created/updated → JWT returned
- Same QQ number re-scan → existing account updated (not duplicated)
- Protected route with Bearer token → 200
- Protected route without token → 401
- Add/list/remove accounts via API
- Cookie switch between accounts works
