## Task List

### 1. Dependencies

- [ ] 1.1 Add jsonwebtoken and @types/jsonwebtoken to packages/server
- [ ] 1.2 npm install at root level

### 2. AuthModule

- [ ] 2.1 Create packages/server/src/auth/auth-module.ts (sign/verify/refresh methods)
- [ ] 2.2 Add barrel export in packages/server/src/auth/index.ts

### 3. Auth Middleware

- [ ] 3.1 Create packages/server/src/auth/middleware.ts (Express-compatible auth middleware)
- [ ] 3.2 Integrate middleware with existing Express app routes

### 4. Account Service

- [ ] 4.1 Create packages/server/src/auth/account-service.ts (CRUD + cookie management)
- [ ] 4.2 Wire AccountService with AccountRepo from change 2

### 5. API Routes

- [ ] 5.1 Create packages/server/src/auth/routes.ts (login, account list/add/remove endpoints)
- [ ] 5.2 Mount routes on Express app

### 6. Cookie Manager

- [ ] 6.1 Create packages/server/src/gateway/cookie-manager.ts (per-account cookie isolation)
- [ ] 6.2 Implement switch account → load cookies → inject into requests flow

### 7. Build & Verification

- [ ] 7.1 tsc --build passes
- [ ] 7.2 npm run build passes (all 3 workspaces)
- [ ] 7.3 npm run typecheck passes
- [ ] 7.4 Verify end-to-end: add account → login → get JWT → access protected route
