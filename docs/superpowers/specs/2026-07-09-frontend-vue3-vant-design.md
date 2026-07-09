---
comet_change: frontend-vue3-vant
role: technical-design
canonical_spec: openspec
archived-with: 2026-07-09-frontend-vue3-vant
status: final
---

# Frontend Vue3 + Vant4 — Technical Design

## Pages

1. Login — QR login form, token persistence via localStorage
2. Accounts — list accounts, add by uin, delete with confirmation dialog
3. Modules — list from /api/modules, run buttons with loading state
4. Logs — table of recent execution logs, filter by module, clear all

## Navigation

Vant Tabbar (bottom navigation) with 4 items.

## Auth

- Axios interceptor reads token from localStorage
- 401 responses redirect to login
- Token stored after successful QR login

## Setup

- Vue Router with 4 routes
- App.vue: Tabbar + router-view
- API client: axios with baseURL = http://localhost:3001

