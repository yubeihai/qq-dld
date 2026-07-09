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
