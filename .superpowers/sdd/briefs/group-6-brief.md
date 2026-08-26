# Group 6: Cross-Package Orchestration + Verification

## Tasks Covered
- Task 6.1: Add root orchestration scripts to `package.json`
- Task 6.2: Full verification matrix (8 checks)
- Task 6.3: Manual cross-boundary spot check (documented)
- Task 6.4: Rollback path documentation (documented)

## Context
All 3 workspace packages (shared, server, web) are now built and verified individually. Now we wire them together at root level and run the full cross-package verification.

## Environment
- Repo root: `E:\github\qq-dld`
- Platform: Windows (PowerShell 5.1)
- Current branch: `feature/20260708/monorepo-scaffolding`

## 6.1 Add root orchestration scripts

File: `E:\github\qq-dld\package.json`

Append the following to `scripts` (additive only; do NOT touch legacy `start`/`stop`/`dev`):

```json
"build": "npm run build --workspaces",
"typecheck": "tsc --build --force && vue-tsc --noEmit -p packages/web/tsconfig.json",
"dev:workspaces": "npm run dev --workspaces"
```

Full `scripts` block after changes:
```json
"scripts": {
  "start": "node src/web/index.js",
  "stop": "node stop.js",
  "dev": "node src/web/index.js",
  "build": "npm run build --workspaces",
  "typecheck": "tsc --build --force && vue-tsc --noEmit -p packages/web/tsconfig.json",
  "dev:workspaces": "npm run dev --workspaces"
}
```

## 6.2 Verification Matrix

Run each from repo root in PowerShell:

| # | Command | Expected |
|---|---------|----------|
| 6.2.1 | `npm install` | exit 0; workspaces link |
| 6.2.2 | `npm ls --workspaces --depth=0` | lists 3 workspaces with `0.0.0` |
| 6.2.3 | `npx tsc --showConfig -p packages/shared/tsconfig.json` | prints extended config |
| 6.2.4 | `npm run build --workspaces` | exits 0; builds shared → server → web |
| 6.2.5 | `npm run build` | exit 0 (root orchestration) |
| 6.2.6 | `npm run typecheck` | exit 0: `tsc --build --force` then `vue-tsc --noEmit` |
| 6.2.7 | `node packages\server\dist\index.js` | logs `[qq-dld/server] skeleton ready sample` |
| 6.2.8 | `npm start` (background) + check port 3000 | legacy app runs (manual check) |
| 6.2.9 | `npm stop` | legacy stop script runs |
| 6.2.10 | Inspect `packages/web/dist/index.html` | Vite index present with hashed assets |
| 6.2.11 | `git status --short` | only additive artifacts; no `src/`, `public/`, `data/`, `stop.js` changes |

## Commit
After completing, commit with: `feat: add root orchestration scripts and verify full monorepo build`
