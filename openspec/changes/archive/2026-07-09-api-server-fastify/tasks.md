## 1. Dependencies

- [x] 1.1 Install fastify v4 + @fastify/cors + @fastify/jwt + @sinclair/typebox in packages/server

## 2. Server Setup

- [x] 2.1 Create packages/server/src/server.ts with Fastify instance creation, plugin registration, CORS, error handler
- [x] 2.2 Create packages/server/src/server/error-handler.ts with centralized error-to-HTTP mapping

## 3. Auth Plugin

- [x] 3.1 Create packages/server/src/plugins/auth.ts wrapping AuthModule + AuthMiddleware into Fastify plugin
- [x] 3.2 Register preHandler hook on protected route prefixes

## 4. Status Route

- [x] 4.1 Create packages/server/src/routes/status.ts with GET /api/status (no auth required)

## 5. Accounts Routes

- [x] 5.1 Create packages/server/src/routes/accounts.ts with GET /api/accounts, POST /api/accounts, DELETE /api/accounts/:id

## 6. Logs Routes

- [x] 6.1 Create packages/server/src/routes/logs.ts with GET /api/logs, DELETE /api/logs (auth required)

## 7. Scheduler Plugin

- [x] 7.1 Create packages/server/src/plugins/scheduler.ts with Fastify lifecycle integration
- [x] 7.2 Wire node-schedule start/stop to onReady/onClose

## 8. Startup Script

- [x] 8.1 Create packages/server/src/index.ts with start() function: DataLayer.initialize() → register plugins → listen
- [x] 8.2 Update packages/server/package.json with "start" script

## 9. Verification

- [x] 9.1 npm run build passes
- [x] 9.2 Start server, smoke test GET /api/status
- [x] 9.3 Smoke test auth-protected routes return 401 without token
