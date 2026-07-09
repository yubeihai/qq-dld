# Comet Design Handoff

- Change: auth-and-account
- Phase: design
- Mode: compact
- Context hash: b55ee35b41d505c909b1d7f571bbc771524ddf83ec701de99a03ed415792b465

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/auth-and-account/proposal.md

- Source: openspec/changes/auth-and-account/proposal.md
- Lines: 1-29
- SHA256: 8e5a24f071e35686ee190ef07e2fc99f94a69350e218dfbbe9863e15e990f489

```md
## Why

QQ DLD currently has no auth layer. Multi-account operations rely on manual cookie switching. A JWT-based auth system is needed to secure API routes and manage multiple accounts with isolated cookies.

## What Changes

- JWT auth module: sign, verify, refresh tokens with configurable expiry
- Multi-account management API: add, switch, delete accounts; QR-login cookie persistence
- Auth middleware: protect `/api/*` routes; return 401 for invalid/missing tokens
- Cookie isolation: per-account cookie storage and request injection
- New dependency: `jsonwebtoken`

## Capabilities

### New Capabilities

- `auth-login`: JWT login and token management (sign/verify/refresh/expiry)
- `account-management`: Multi-account CRUD (add/switch/delete), QR cookie persistence

### Modified Capabilities

- None — first-time auth layer addition, no existing specs modified

## Impact

- packages/server: new `src/auth/` directory (JWT module + middleware + routes)
- Data layer: accounts table already exists (change 2); seed/setup logic needed on first init
- New deps: `jsonwebtoken` + `@types/jsonwebtoken`
- QR login flow (existing puppeteer-core) will be integrated with auth routes

```

## openspec/changes/auth-and-account/design.md

- Source: openspec/changes/auth-and-account/design.md
- Lines: 1-47
- SHA256: 34744b598ae49d360bf3b8d858c7554a6be1d1a8ec1d4b410cc51b36bb5047e7

```md
## Context

After change 1 (monorepo scaffolding) and change 2 (data layer), the project has TypeScript monorepo structure and a multi-account database. This change adds the auth layer that will protect all future API routes.

## Goals & Non-Goals

- Goals: JWT token lifecycle, multi-account management, auth middleware, cookie isolation
- Non-Goals: Frontend login page (change 6), game business logic, route migration (change 4)

## Decisions

### D1: JWT Library — jsonwebtoken

Chose `jsonwebtoken` over `jose` (more modern but larger API surface) and `passport` (too opinionated for this project). jsonwebtoken is mature and well-understood.

### D2: AuthModule Singleton

`AuthModule` class wraps `sign()`, `verify()`, `decode()`. Accepts secret from constructor (DI-ready). Default TTL 24h.

### D3: Auth Middleware as Express-Compatible

Since Fastify migration is change 4, write middleware as Express `(req, res, next)` style now. It will be migrated to Fastify `preHandler` in change 4. This avoids blocking progress.

### D4: AccountService CRUD

`AccountService` uses `AccountRepo` (from change 2). Methods: `list()`, `getById()`, `add(uin, nickname, cookies)`, `remove(id)`, `switch(id)`. The switch method updates a "current account" marker in settings table.

### D5: Cookie Isolation

Store cookies per-account in accounts table. On account selection, load cookies into a CookieManager singleton that injects them into game API requests (reusing the existing src/gateway/cookie-manager.js design concept).

### D6: JWT Secret Management

Read from `JWT_SECRET` env var. No fallback — enforce explicit configuration. Print startup warning if unset.

## Risks & Trade-offs

- Express middleware delays Fastify-native auth (mitigated by clear migration plan in D3)
- JWT tokens stored client-side only; no server-side session store (acceptable for this project scale)

## Migration Plan

1. Install deps → 2. Create AuthModule → 3. Create AccountService → 4. Create middleware → 5. Create routes → 6. Wire into existing Express app → 7. Verify end-to-end login flow

## Open Questions

- None

```

## openspec/changes/auth-and-account/tasks.md

- Source: openspec/changes/auth-and-account/tasks.md
- Lines: 1-38
- SHA256: 88cc1ac0633b0d3084ca627ede4dee617d956333c78c8b1c436c695740ab92cd

```md
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

```

## openspec/changes/auth-and-account/specs/account-management/spec.md

- Source: openspec/changes/auth-and-account/specs/account-management/spec.md
- Lines: 1-36
- SHA256: 5dc145dc6c70514f238b90b3df648dcd0a0a2b0490069c365a56f32e9181c902

```md
### Requirement: Account CRUD

The system SHALL support adding, listing, and removing accounts with associated cookies.

#### Scenario: Add Account

- WHEN a new account with uin and cookies is added via AccountService.add()
- THEN the account is persisted in the database with status 'active'

#### Scenario: List Accounts

- WHEN AccountService.list() is called
- THEN an array of all accounts is returned, excluding cookie values for security

#### Scenario: Remove Account

- WHEN an existing account is removed via AccountService.remove()
- THEN the account and all associated data (module configs, logs) are deleted (CASCADE)

### Requirement: Cookie Persistence

Each account SHALL store its own login cookies in the accounts table, used for game API requests.

#### Scenario: Store and Retrieve Cookies

- WHEN cookies are saved for an account via AccountService.updateCookies()
- THEN the cookies are persisted and retrievable
- WHEN AccountService.getCookies() is called for that account
- THEN the stored cookies are returned

#### Scenario: Switch Active Account

- WHEN a different account is selected via AccountService.switch()
- THEN the active account id is persisted in settings
- WHEN the application requests the current account
- THEN the selected account's cookies are used for game API requests

```

## openspec/changes/auth-and-account/specs/auth-login/spec.md

- Source: openspec/changes/auth-and-account/specs/auth-login/spec.md
- Lines: 1-39
- SHA256: a4a71f5effa5be839794a1bd428137feb779358853b8dd1c7ff470304c942808

```md
### Requirement: JWT Token Signing

The system SHALL support signing a JWT token with an account id as the payload, with configurable expiry (default 24h).

#### Scenario: Sign and Verify Token

- WHEN a valid account id is provided to AuthModule.sign()
- THEN a valid JWT token string is returned
- WHEN that token is passed to AuthModule.verify()
- THEN the decoded payload containing the account id is returned

#### Scenario: Expired Token Rejection

- WHEN an expired JWT token is passed to AuthModule.verify()
- THEN an error is thrown and the request is rejected

#### Scenario: Invalid Signature Rejection

- WHEN a token signed with a different secret is passed to AuthModule.verify()
- THEN an error is thrown and the request is rejected

### Requirement: Auth Middleware

The system SHALL provide middleware that extracts and validates the JWT from the Authorization header (Bearer scheme), attaching the decoded payload to `req.user`.

#### Scenario: Protected Route Access

- WHEN a request with a valid Bearer token is made to a protected route
- THEN the request passes through to the route handler with `req.user` populated

#### Scenario: Missing Token

- WHEN a request without an Authorization header is made to a protected route
- THEN a 401 response is returned

#### Scenario: Invalid Token

- WHEN a request with an invalid or expired Bearer token is made to a protected route
- THEN a 401 response is returned

```
