## Task List

### 1. Dependencies

- [ ] 1.1 Add jsonwebtoken and @types/jsonwebtoken to packages/server
- [ ] 1.2 npm install at root level
- [ ] 1.3 Remove puppeteer-core from packages/server (if present)

### 2. AuthModule

- [ ] 2.1 Create packages/server/src/auth/auth-module.ts (sign/verify/refresh methods)
- [ ] 2.2 Add barrel export in packages/server/src/auth/index.ts

### 3. Auth Middleware

- [ ] 3.1 Create packages/server/src/auth/middleware.ts (Express-compatible auth middleware)
- [ ] 3.2 Integrate middleware with existing Express app routes

### 4. Account Service

- [ ] 4.1 Create packages/server/src/auth/account-service.ts (CRUD + cookie management)
- [ ] 4.2 Wire AccountService with AccountRepo from change 2

### 5. QQ Login Client

- [ ] 5.1 Create packages/server/src/auth/qq-login-client.ts (ptqrshow/ptqrlogin/completeLogin methods)
- [ ] 5.2 Implement hash33 (ptqrtoken) calculation
- [ ] 5.3 Implement ptuiCB response parsing (extract status code, callback URL, nickname)
- [ ] 5.4 Implement OAuth chain: ptqrlogin success → login_jump → dld.qzapp.z.qq.com redirect → collect game-site cookies
- [ ] 5.5 Implement Set-Cookie header parsing for multi-domain cookie jar

### 6. QR Session Manager

- [ ] 6.1 Create packages/server/src/auth/qr-session-manager.ts (in-memory Map<sessionId, QrSession>)
- [ ] 6.2 Implement session creation, status tracking, and timeout cleanup (2 min expiry)

### 7. API Routes

- [ ] 7.1 Create packages/server/src/auth/routes.ts with POST /api/auth/qr/start endpoint
- [ ] 7.2 Add GET /api/auth/qr/status?id=<sessionId> polling endpoint
- [ ] 7.3 Add POST /api/auth/logout endpoint
- [ ] 7.4 Add account list/delete endpoints (GET /api/accounts, DELETE /api/accounts/:id)
- [ ] 7.5 Implement login success flow: extract uin → AccountService find/create/update → sign JWT → return {token, account}
- [ ] 7.6 Mount routes on Fastify server

### 8. Cookie Manager

- [ ] 8.1 Create packages/server/src/gateway/cookie-manager.ts (per-account cookie isolation)
- [ ] 8.2 Implement switch account → load cookies → inject into requests flow

### 9. Frontend (Login.vue)

- [ ] 9.1 Rewrite Login.vue: auto-call /qr/start on page entry, display QR image
- [ ] 9.2 Implement /qr/status polling (2s interval) with status mapping UI
- [ ] 9.3 Handle expired state with refresh button
- [ ] 9.4 On success: store token + account in localStorage, redirect to /modules

### 10. Build & Verification

- [ ] 10.1 tsc --build passes
- [ ] 10.2 npm run build passes (all workspaces)
- [ ] 10.3 npm run typecheck passes
- [ ] 10.4 Verify end-to-end: /qr/start → scan → /qr/status success → JWT → access protected route
- [ ] 10.5 Verify same QQ re-scan updates existing account (no duplicate)
