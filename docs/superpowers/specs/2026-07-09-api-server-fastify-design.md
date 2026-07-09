---
comet_change: api-server-fastify
role: technical-design
canonical_spec: openspec
---

# API Server Fastify Migration

## Context

Replace the legacy Express server (src/web/index.js) with a Fastify server at packages/server. The new server will use the auth modules created in change 3 (AuthModule, AuthMiddleware) and the data layer from change 2 (DataLayer, repositories).

## Goals & Non-Goals

**Goals:**
- Fastify server replacing Express (core + all routes)
- JWT auth plugin using existing AuthModule
- Route parity with Express: status, accounts, logs, modules, scheduler, settings
- Scheduler plugin wrapping node-schedule
- Legacy backward compatibility during transition

**Non-Goals:**
- Game module logic (change 5)
- Frontend UI (change 6)
- Removing Express entirely yet

## Design Decisions

**D1: Fastify with @fastify/jwt for auth**
Already have AuthModule from change 3. @fastify/jwt provides request-level JWT verification that integrates natively with Fastify's hook system. The existing AuthMiddleware (Express-compatible) is not reused; instead, a Fastify-specific auth plugin wraps AuthModule.

**D2: Plugin architecture for routes**
Each route group becomes a Fastify plugin: account-routes, log-routes, module-routes, scheduler-routes, settings-routes. Separated into packages/server/src/routes/. Each plugin is registered at the server level.

**D3: Scheduler as Fastify plugin**
SchedulerPlugin wraps node-schedule, provides module lifecycle hooks, and exposes REST endpoints. Uses the existing scheduler j ob queue pattern but integrated as a Fastify plugin lifecycle (onRegister/onReady/onClose).

**D4: Two-server transition period**
Start both Express (port 3000) and Fastify (port 3001) during transition. Express proxies /api requests to Fastify. When Fastify is stable, switch to single Fastify server.

**D5: Config from environment + defaults**
Server config (port, JWT secret, DB path) from process.env with sensible defaults. No config file.

## Risks & Trade-offs

- @fastify/jwt vs roll-your-own: framework integration wins for lifecycle management
- Two-server adds complexity but enables gradual migration
- plugin scoping must be correct (Fastify decorators vs request-level)

## Test Strategy

- Build verification: npm run build (tsc -b)
- Manual smoke test: start Fastify, verify /api/status returns 200
- Route tests can be added later when vitest is configured
