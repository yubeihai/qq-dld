## Why

The current qq-dld is a single-package CommonJS project (Express + sql.js + a single HTML page). The planned full-stack refactor to TypeScript + Fastify + Vue3 + Vant4 + better-sqlite3 with a layered architecture (parser/service/repository/data), multi-account support, and JWT auth cannot fit cleanly into the existing flat `src/` layout. A npm workspaces monorepo must be scaffolded first so each subsequent change (data layer, auth, API, module refactor, frontend) has a well-defined home, shared types, and a working TypeScript build pipeline.

## What Changes

- **BREAKING**: Restructure the repository into an npm workspaces monorepo with three packages: `packages/server` (Fastify backend), `packages/shared` (cross-package TypeScript types & contracts), and `packages/web` (Vue3 + Vant4 frontend). The root `package.json` becomes a workspaces orchestrator.
- Add a base `tsconfig.json` at the root plus per-package `tsconfig.json` extending it (with project references for type-safe cross-package imports).
- Add build tooling: `tsup` (or `tsc`) for `packages/server` and `packages/shared`, `vite` for `packages/web`.
- Add `packages/shared` skeleton exporting shared TypeScript types (account, module, log, task, config domain models) consumed by both server and web.
- Add empty package entry points (`packages/server/src/index.ts`, `packages/shared/src/index.ts`, `packages/web/src/main.ts`) that compile and run without error.
- Add root-level scripts to install, build, lint, and typecheck all workspaces (`npm run build`, `npm run typecheck`, `npm run dev`).
- Migrate the root `package.json` engine/dependency boundaries: shared dev dependencies (TypeScript, tsup, vite, types) hoisted to root; package-specific deps declared in each workspace.
- Preserve the existing `src/` CommonJS codebase in place during scaffolding so the legacy app keeps running; new TS code lives under `packages/`. A later change migrates logic out of `src/`.

## Capabilities

### New Capabilities
- `monorepo-structure`: npm workspaces layout, TypeScript configuration hierarchy with project references, per-package build tooling, and a shared-types package that establishes the cross-package contract for all subsequent changes.

### Modified Capabilities
<!-- None — this is the first change; no existing specs in openspec/specs/. -->

## Impact

- **Repo layout**: introduces `packages/{server,shared,web}/` directories and root workspace config; existing `src/`, `public/`, `data/` remain untouched during this change.
- **Build system**: root `package.json` gains `workspaces` field, hoisted devDependencies (typescript, tsup, vite, ts-node), and orchestration scripts; per-workspace `package.json` files declare their own dependencies.
- **Dependencies**: new dev dependencies — `typescript`, `tsup`, `vite`, `@types/node`, `vue`, `vant` (web only, declared in workspace). Existing runtime deps (express, sql.js, axios, puppeteer-core, node-schedule) stay on the legacy `src/` path and are NOT yet moved into `packages/server` (that happens in later changes).
- **Tooling config**: new `tsconfig.json` (base), `tsconfig.*.json` per package, `vite.config.ts` for web.
- **No runtime behavior change**: the legacy Express app in `src/` continues to be the running application; `packages/` only needs to build and typecheck cleanly.
