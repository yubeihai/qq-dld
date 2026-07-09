## Task List

### 1. Dependencies

- [x] 1.1 Add jsonwebtoken and @types/jsonwebtoken to packages/server
- [x] 1.2 npm install at root level
- [x] 1.3 Remove puppeteer-core from packages/server (if present)

### 2. AuthModule

- [x] 2.1 Create packages/server/src/auth/auth-module.ts (sign/verify/refresh methods)
- [x] 2.2 Add barrel export in packages/server/src/auth/index.ts

### 3. Auth Middleware

- [x] 3.1 Create packages/server/src/auth/middleware.ts (Express-compatible auth middleware)
- [x] 3.2 Integrate middleware with existing Express app routes

### 4. Account Service

- [x] 4.1 Create packages/server/src/auth/account-service.ts (CRUD + cookie management)
- [x] 4.2 Wire AccountService with AccountRepo from change 2

### 5. QQ Login Client

- [x] 5.1 Create packages/server/src/auth/qq-login-client.ts (ptqrshow/ptqrlogin/completeLogin methods)
- [x] 5.2 Implement hash33 (ptqrtoken) calculation
- [x] 5.3 Implement ptuiCB response parsing (extract status code, callback URL, nickname)
- [x] 5.4 Implement OAuth chain: ptqrlogin success → login_jump → dld.qzapp.z.qq.com redirect → collect game-site cookies
- [x] 5.5 Implement Set-Cookie header parsing for multi-domain cookie jar

### 6. QR Session Manager

- [x] 6.1 Create packages/server/src/auth/qr-session-manager.ts (in-memory Map<sessionId, QrSession>)
- [x] 6.2 Implement session creation, status tracking, and timeout cleanup (2 min expiry)

### 7. API Routes

- [x] 7.1 Create packages/server/src/auth/routes.ts with POST /api/auth/qr/start endpoint
- [x] 7.2 Add GET /api/auth/qr/status?id=<sessionId> polling endpoint
- [x] 7.3 Add POST /api/auth/logout endpoint
- [x] 7.4 Add account list/delete endpoints (GET /api/accounts, DELETE /api/accounts/:id)
- [x] 7.5 Implement login success flow: extract uin → AccountService find/create/update → sign JWT → return {token, account}
- [x] 7.6 Mount routes on Fastify server

### 8. Cookie Manager

- [x] 8.1 Create packages/server/src/gateway/cookie-manager.ts (per-account cookie isolation)
- [x] 8.2 Implement switch account → load cookies → inject into requests flow

### 9. Frontend (Login.vue)

- [x] 9.1 Rewrite Login.vue: auto-call /qr/start on page entry, display QR image
- [x] 9.2 Implement /qr/status polling (2s interval) with status mapping UI
- [x] 9.3 Handle expired state with refresh button
- [x] 9.4 On success: store token + account in localStorage, redirect to /modules

### 10. Build & Verification

- [x] 10.1 tsc --build passes
- [x] 10.2 npm run build passes (all workspaces)
- [x] 10.3 npm run typecheck passes
- [x] 10.4 Verify end-to-end: /qr/start → scan → /qr/status success → JWT → access protected route
- [x] 10.5 Verify same QQ re-scan updates existing account (no duplicate)
