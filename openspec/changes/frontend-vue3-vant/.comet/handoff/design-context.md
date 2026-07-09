# Comet Design Handoff

- Change: frontend-vue3-vant
- Phase: design
- Mode: compact
- Context hash: abc447880ab50247d435b26d385cb5a5b776cb65324bafc44a0390ca4c6ced93

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/frontend-vue3-vant/proposal.md

- Source: openspec/changes/frontend-vue3-vant/proposal.md
- Lines: 1-24
- SHA256: 07f7b9c9ecfe9016db6bd0a13dc2dfbf77cc28432f3dc2cf8162a54d0bd34404

```md
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

```

## openspec/changes/frontend-vue3-vant/design.md

- Source: openspec/changes/frontend-vue3-vant/design.md
- Lines: 1-18
- SHA256: 7427651754938ae906247a1b804219ae7f5654877fe89f9ec1e32761d81ccef2

```md
## Design Approach

### Pages
- Login: QR login status polling, JWT token storage (localStorage)
- Accounts: list accounts, add by uin, delete with confirm
- Modules: list from /api/modules, run with POST /api/run/:id
- Logs: list from /api/logs, clear with DELETE /api/logs

### Navigation
Vant Tabbar at bottom with 4 tabs: 首页 (Status), 账号 (Accounts), 模块 (Modules), 日志 (Logs)

### HTTP Client
Axios instance with baseURL to Fastify (port 3001), interceptor attaches JWT from localStorage.

### Auth Flow
1. User logs in via QR → JWT stored in localStorage
2. Axios interceptor adds Authorization: Bearer <token>
3. 401 response → redirect to login page

```

## openspec/changes/frontend-vue3-vant/tasks.md

- Source: openspec/changes/frontend-vue3-vant/tasks.md
- Lines: 1-16
- SHA256: e695f43eec03724a524e0367d4740c3b53ac30df3366f9683d3f69fde026cc18

```md
## 1. Core Setup

- [ ] 1.1 Create packages/web/src/api/http.ts (axios instance with auth interceptor)
- [ ] 1.2 Create packages/web/src/router/index.ts (Vue Router with 4 pages)
- [ ] 1.3 Update packages/web/src/App.vue (navigation skeleton)

## 2. Pages

- [ ] 2.1 Create Login.vue (QR login, token storage)
- [ ] 2.2 Create Accounts.vue (account list/add/delete)
- [ ] 2.3 Create Modules.vue (module list, run buttons)
- [ ] 2.4 Create Logs.vue (execution log list, history)

## 3. Verification

- [ ] 3.1 npm run build passes (vue-tsc + vite build)

```

## openspec/changes/frontend-vue3-vant/specs/frontend-pages/spec.md

- Source: openspec/changes/frontend-vue3-vant/specs/frontend-pages/spec.md
- Lines: 1-25
- SHA256: 2251ae916204db596e0f7a44e6e0f881c84cc222c6d429ca9751574c21ceb3d6

```md
## ADDED Requirements

### Requirement: Frontend pages

The web package SHALL have Vue3 pages for login, accounts, modules, and logs, using Vant4 components and Vant Tabbar navigation.

#### Scenario: Login page displays QR
Given the web app is loaded
When the user navigates to Login page
Then a QR code placeholder and login button are displayed

#### Scenario: Account management
Given the user is logged in
When navigating to Accounts page
Then a list of accounts is displayed with add/delete options

#### Scenario: Module dashboard
Given the user is logged in
When navigating to Modules page
Then the module list is displayed with run buttons

#### Scenario: Logs page
Given the user is logged in
When navigating to Logs page
Then recent execution logs are displayed

```
