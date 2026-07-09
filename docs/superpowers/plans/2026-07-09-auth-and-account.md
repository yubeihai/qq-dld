---
change: auth-and-account
design-doc: docs/superpowers/specs/2026-07-09-auth-and-account-design.md
base-ref: ef688e4c21569148023ebab3adcc61f2013379eb
---

## Group 1: Dependencies
1.1 Install jsonwebtoken + @types/jsonwebtoken in packages/server

## Group 2: AuthModule
2.1 Create packages/server/src/auth/auth-module.ts (sign/verify/refresh)
2.2 Create packages/server/src/auth/index.ts (barrel export)

## Group 3: Auth Middleware
3.1 Create packages/server/src/auth/middleware.ts (Express-compatible)

## Group 4: Account Service
4.1 Create packages/server/src/auth/account-service.ts (CRUD via AccountRepo)
4.2 Integrate with SettingsRepo for active account tracking

## Group 5: Routes
5.1 Create packages/server/src/auth/routes.ts (Express router)
5.2 Wire into existing Express app in src/web/app.js

## Group 6: Cookie Manager
6.1 Create packages/server/src/gateway/cookie-manager.ts

## Group 7: Verification
7.1 tsc --build passes
7.2 npm run build passes
