## Why

The current public/index.html is a single-page frontend. The new Vue3 + Vant4 skeleton from change 1 needs to be fleshed out with real pages: login, account management, module dashboard, and logs.

## What Changes

- Login page with QR code display and status polling
- Account management page with add/list/delete
- Module dashboard page with module list and run buttons
- Execution logs page with filter and history
- Navigation via Vant Tabbar
- HTTP client using axios consuming the Fastify API (change 4)

## Capabilities

### New Capabilities
- `frontend-pages`: Vue3 pages built with Vant4 for login, accounts, modules, and logs

## Impact

- packages/web/src/: existing App.vue, main.ts, env.d.ts
- New pages: Login.vue, Accounts.vue, Modules.vue, Logs.vue
- Navigation component
- HTTP client utility
