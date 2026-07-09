---
comet_change: auth-and-account
role: technical-design
canonical_spec: openspec
---

# Auth and Account Management — Technical Design

## Context

This change adds JWT auth + multi-account management to qq-dld. It builds on the data layer (change 2) and prepares for Fastify route migration (change 4).

## Implementation Approach

### AuthModule

```
packages/server/src/auth/
├── auth-module.ts       # sign() / verify() / refresh()
├── middleware.ts        # Express-compatible auth middleware
├── account-service.ts  # Account CRUD + cookie management
├── routes.ts           # Express router for auth endpoints
└── index.ts            # barrel exports
```

### Key Design Decisions

1. **JWT with jsonwebtoken**: symmetric HMAC-SHA256, 24h TTL, secret from JWT_SECRET env
2. **AuthMiddleware**: Express (req, res, next) style — compatible with existing Express routes; migrates to Fastify preHandler in change 4
3. **AccountService**: wraps AccountRepo (from change 2) with add/list/remove/switch methods
4. **Cookie isolation**: cookies stored in accounts table; switch-account updates a current-account-id in settings table; CookieManager reads from there
5. **Login flow**: POST /api/auth/login (QR code trigger + cookie capture) → JWT → subsequent calls use Bearer token

## Risks

- QR login is blocking/polling — may need timeout handling
- JWT secret management: env-only, no fallback

## Acceptance Verification

- POST /api/auth/login → returns JWT
- Protected route with Bearer token → 200
- Protected route without token → 401
- Add/switch/list/remove accounts via API
- Cookie switch between accounts works
