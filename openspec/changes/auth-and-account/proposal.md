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
