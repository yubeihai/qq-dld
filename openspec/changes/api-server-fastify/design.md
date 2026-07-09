## Context

Change 1 (monorepo-scaffolding) established the npm workspaces with packages/server as the target for the new server architecture. Change 2 (data-layer-migration) added better-sqlite3 with DataLayer, migrations, and repositories. Change 3 (auth-and-account) added JWT auth, account CRUD, and cookies. This change wires them together under a Fastify HTTP server, replacing the legacy Express app as the API gateway.

## Goals & Non-Goals

Goals:
- Fastify v4 server in packages/server as the new API gateway
- Plugin-based architecture: auth plugin, route plugins, scheduler plugin
- Schema validation on all API endpoints
- All existing routes migrated 1:1 from Express to Fastify
- Startup script that initializes DataLayer, runs migrations, registers plugins, starts server
- Legacy Express app (src/web/index.js) remains untouched during transition

Non-Goals:
- Removing the legacy Express app
- Adding new API endpoints beyond what Express currently provides
- Frontend changes (Vue3/Vant4 frontend is change 6)
- Module execution (change 5)

## Decisions

### D1: Fastify v4 with TypeBox for schema validation
Fastify v4 has native TS support. Use @sinclair/typebox for runtime-validated JSON schemas with full TS type inference. This provides compile-time + runtime validation.

### D2: Plugin-based architecture
Each functional area becomes a Fastify plugin:
- AuthPlugin: wraps AuthModule, registers preHandler hook for JWT verification
- Route plugins: status, accounts (one file per route group)
- SchedulerPlugin: wraps node-schedule, registers onReady/onClose lifecycle hooks
- ErrorPlugin: centralized error handler transforming errors to Fastify Reply format

### D3: Route migration (1:1 from Express)
Map existing Express routes:
- GET /api/status → packages/server/src/routes/status.ts
- POST /api/auth/login → auth plugin
- POST /api/auth/logout → auth plugin
- GET /api/accounts → packages/server/src/routes/accounts.ts
- POST /api/accounts → accounts route
- DELETE /api/accounts/:id → accounts route
- GET /api/modules → modules route (stub until change 5)
- GET /api/logs → logs route
- DELETE /api/logs → logs route
- POST /api/run/:id → modules route (stub until change 5)

Express routes not yet migrated: scheduler routes (deferred to maintain backward compat).

### D4: Schema validation with TypeBox
Each route handler gets a schema object: { body: Type.Object(...), querystring: Type.Object(...), params: Type.Object(...), response: { 200: Type.Object(...) } }. Fastify validates at the framework level before the handler runs.

### D5: Centralized error handling
Fastify setErrorHandler catches all errors, maps known error types (AuthError, ValidationError, NotFoundError) to HTTP codes, and returns structured JSON.

### D6: Startup entry point
packages/server/src/index.ts exports a `start()` function that:
1. Calls DataLayer.initialize() (creates/runs migrations)
2. Registers all plugins
3. Starts listening on PORT (env or 3001)

## Risks & Trade-offs

- Risk: Route migration may miss edge cases in Express middleware order. Mitigation: each route handler is tested independently with curl/HTTP.
- Risk: @fastify/jwt adds a dependency on jsonwebtoken internally, but our AuthModule also uses jsonwebtoken directly — no conflict, both are independent.
- Trade-off: TypeBox adds a dependency vs. raw JSON Schema objects. TypeBox wins for TS type inference.

## Migration Plan

1. Install Fastify deps in packages/server
2. Create server setup with plugin registration
3. Create auth plugin wrapping AuthModule
4. Create status route
5. Create accounts routes
6. Create scheduler plugin
7. Create error handler plugin
8. Create startup script
9. Verify build + smoke test

## Open Questions

- Should scheduler integration be deferred to a separate change? Decision: include basic lifecycle integration (start/stop), defer detailed task execution to change 5.
