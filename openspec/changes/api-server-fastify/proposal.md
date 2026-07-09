## Why

The current Express server (src/web/index.js) is tightly coupled with the legacy codebase and lacks the plugin architecture, schema validation, and TypeScript support needed for the new layered architecture. Migrating to Fastify provides a modular plugin system, built-in schema validation (via JSON Schema), better TypeScript integration, and a clear path to deprecate the legacy Express app.

## What Changes

- Create a Fastify server in `packages/server/` as the new API gateway
- Migrate all existing Express routes to Fastify plugins/routes
- Wire up existing auth modules (AuthModule, AuthMiddleware) as Fastify plugins
- Wire up existing repositories (AccountRepo, etc.) via DataLayer
- Add schema validation for all API endpoints using Fastify's JSON Schema
- Integrate the Scheduler into the Fastify lifecycle
- **BREAKING**: The Fastify server runs on port 3001 (Express stays on 3000 during transition)
- **BREAKING**: API response format changes to Fastify's structured format

## Capabilities

### New Capabilities
- `fastify-server`: Fastify server setup with plugin registration, schema validation, lifecycle hooks, CORS, and error handling

### Modified Capabilities
- (none — first Fastify capability in the new architecture)

## Impact

- New dependency: `fastify` (v4) + `@fastify/cors` + `@fastify/jwt` in packages/server
- AuthModule (created in change 3) needs a Fastify plugin wrapper
- AuthMiddleware (created in change 3) hooks into Fastify's preHandler
- DataLayer + repositories are already built for direct use
- Existing Express app remains unchanged during transition
- Scheduler integration via Fastify lifecycle hooks (onReady, onClose)
- All routes moved from `src/web/routes/*.js` to `packages/server/src/routes/*.ts`
