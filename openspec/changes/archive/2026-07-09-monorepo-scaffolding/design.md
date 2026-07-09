## Context

qq-dld is currently a single-package CommonJS Node.js project: `package.json` at root, all source under `src/` (Express web server, sql.js database, 38 game-action modules, puppeteer扫码登录, node-schedule scheduler), and a single `public/index.html` frontend. It runs via `node src/web/index.js`.

The planned full-stack refactor (TS + Fastify + Vue3 + Vant4 + better-sqlite3, multi-account, JWT, layered parser/service/repository/data architecture, 38-module four-layer split) is too large for one change and has been split into six sequential changes. **This first change** scaffolds only the monorepo skeleton — no business logic migrates here. A prior partial refactor exists as untracked JS under `src/db/repositories/`, `src/engine/`, `src/gateway/`, `src/modules/`; it is treated as a blueprint for later changes and is NOT touched here.

Constraints:
- Legacy `src/` app must keep running during scaffolding (no runtime behavior change).
- Windows development environment (PowerShell 5.1, Node.js).
- `data/database.sqlite`, `public/`, `src/` stay in place.

## Goals / Non-Goals

**Goals:**
- Establish an npm workspaces monorepo with three packages: `packages/server`, `packages/shared`, `packages/web`.
- Provide a TypeScript configuration hierarchy (base config + per-package configs with project references) enabling type-safe cross-package imports.
- Provide per-package build tooling that compiles/builds each package cleanly from empty entry points.
- Provide root orchestration scripts (`build`, `typecheck`, `dev:workspaces`) that operate across all workspaces.
- Establish `packages/shared` as the cross-package contract package exporting shared domain types.
- Root devDependencies hold shared tooling (`typescript`, `@types/node`); each workspace declares its own package-specific deps.

**Non-Goals:**
- Migrating any business logic, routes, database access, or game modules into `packages/` (later changes).
- Adding Fastify, better-sqlite3, JWT, or Vue/Vant runtime code (later changes).
- Changing the legacy `src/` Express app or its `package.json` runtime deps.
- Removing or altering `data/`, `public/`, `src/`, `stop.js`.
- CI/CD pipeline setup.

## Decisions

### D1: Three workspaces — `packages/server`, `packages/shared`, `packages/web`
**Rationale:** Clean separation of backend, shared contracts, and frontend. `shared` prevents circular deps between server and web and is the natural home for the domain types that the layered architecture (parser/service/repository/data) will define in later changes.
**Alternatives considered:**
- Two workspaces (backend, frontend) with shared types duplicated — rejected: type drift risk across 38 modules.
- Four workspaces (add `packages/data` for the repository/data layer) — rejected: the data layer is server-internal; exposing it as a top-level workspace adds boundary overhead without a consumer besides `server`. Data layer lives inside `packages/server/src/{repository,data}` in later changes.

### D2: TypeScript project references with a base config (shared + server); web typechecked via vue-tsc
**Rationale:** `tsconfig.base.json` at root holds shared `compilerOptions` (strict, target ES2022, module CommonJS, moduleResolution Node, declaration, declarationMap, sourceMap). `packages/shared` and `packages/server` are composite projects with project references (`server` references `shared`); the root `tsconfig.json` references both so `tsc --build` typechecks and emits them in dependency order. `packages/web` is NOT part of the `tsc --build` graph because Vue SFCs require Volar-based typechecking (`vue-tsc`) and web's `noEmit` conflicts with composite's declaration-emit requirement. Web is typechecked separately via `vue-tsc --noEmit`.
**Alternatives considered:**
- Single tsconfig at root — rejected: doesn't scale to per-package module targets (web needs DOM libs, server needs Node libs).
- No project references, path aliases only — rejected: slower typecheck, no incremental builds.
- Web in tsc --build graph — rejected: Vue SFCs need Volar; composite's declaration-emit requirement conflicts with web's noEmit (Vite does the emit).

### D3: Module output — server & shared compile to CommonJS via `tsc`; web uses Vite (ESM)
**Rationale:** Native Node deps that later changes will use (`better-sqlite3`, `puppeteer-core`) are CommonJS-native; emitting CJS from the server/shared packages avoids ESM/CJS interop hazards. `tsc` emit produces per-file CJS (`.js` + `.d.ts`) that preserves `node_modules` resolution — critical for native addons (`better-sqlite3`'s `.node` file) which bundlers like tsup/esbuild cannot bundle. `tsc --build` also handles declaration emit needed by project references in a single step. The web package uses Vite which natively handles ESM + Vue SFCs.
**Alternatives considered:**
- Pure ESM (`"type": "module"`) for server — rejected: `better-sqlite3` and other CJS deps create interop friction; not worth the risk before the data-layer change.
- `tsup` (esbuild bundling) for server — rejected: esbuild cannot bundle native `.node` addons (better-sqlite3); also requires a dual build chain (tsup for JS + tsc for .d.ts). tsup retained as a future build-speed optimization if needed.

### D4: Root holds shared devDeps; per-package deps declared in each workspace
**Rationale:** Root `package.json` devDependencies: `typescript`, `@types/node` (shared across TS packages). Each workspace declares its own deps: `packages/web` declares `vue`, `vant` (runtime) + `vite`, `@vitejs/plugin-vue`, `vue-tsc` (dev). npm workspaces automatically hoists matching deps to root `node_modules`. Legacy runtime deps (express, sql.js, axios, puppeteer-core, node-schedule) remain on root `package.json` for the still-running `src/` app and are NOT moved yet.
**Alternatives considered:**
- Move all legacy deps into `packages/server` now — rejected: breaks the still-running legacy `src/` app which the root scripts still start.

### D5: Root scripts orchestrate workspaces via `--workspace`; typecheck spans tsc + vue-tsc
**Rationale:** Root `package.json` scripts: `build` = `npm run build --workspaces` (runs in workspaces-array order: shared→server→web), `typecheck` = `tsc --build` (shared+server) && `vue-tsc --noEmit -p packages/web/tsconfig.json`, `dev:workspaces` = concurrently run server watch + web dev, `lint` reserved. Legacy `start`/`stop`/`dev` scripts preserved for the `src/` Express app. This keeps the root as the single entry point for developers.
**Alternatives considered:**
- Per-package-only scripts — rejected: poor DX; users expect root-level `npm run build`.

### D6: `packages/shared` domain type skeletons
**Rationale:** Define the forward-looking domain types that later changes will flesh out: `Account`, `Module`, `ModuleConfig`, `ExecLog`, `Friend`, `TaskConfig`, `SchedulerJob`. Only type declarations (no runtime values) in this change — establishes the contract without coupling to implementations that don't exist yet.
**Alternatives considered:**
- Empty `index.ts` only — rejected: leaves the shared package's purpose ambiguous; a named set of domain types signals intent to later changes.

## Risks / Trade-offs

- **[Risk] Root `package.json` becoming mixed-purpose** (both workspaces orchestrator AND legacy app runner) → Mitigation: keep legacy `start`/`stop`/`dev` scripts pointing at `src/web/index.js`; add workspace scripts under distinct names (`build`, `typecheck`, `dev:workspaces`). Document that legacy scripts will be removed once `packages/server` replaces `src/`.
- **[Risk] npm hoisting conflicts on Windows** (case-sensitivity, symlink behavior) → Mitigation: use npm 9+ workspaces (symlink-free on Windows, uses junctions); verify `npm install` at root succeeds and `npm run build --workspaces` works.
- **[Risk] Project references build order errors** if `shared` isn't built first → Mitigation: `references` array encodes the dependency; `tsc --build` respects it; `workspaces` array ordered shared→server→web.
- **[Trade-off]** Web not in project references → loses incremental typecheck linkage with shared; accepted: Vite dev server has its own HMR, and shared types resolve via node_modules symlink + built .d.ts.
- **[Trade-off]** Legacy and new code coexist temporarily → accepted: necessary to keep the app running during incremental migration; a later change deletes `src/`.

## Migration Plan

1. Add `workspaces` field (ordered shared→server→web) and workspace scripts to root `package.json`; keep existing scripts/dep names.
2. Create `packages/{shared,server,web}/` with per-package `package.json`, `tsconfig.json`, and `src/` entry points.
3. Add `tsconfig.base.json` (root) and root `tsconfig.json` (references shared+server only).
4. Add `vite.config.ts` and `index.html` under `packages/web`.
5. Install root devDeps via `npm install` at root.
6. Verify: `npm run build --workspaces` and `npm run typecheck` succeed; legacy `npm start` still runs `src/web/index.js`.
- **Rollback**: `git checkout` the root `package.json`/lockfile and delete `packages/` + root tsconfigs. No legacy data or code is modified, so rollback is clean.

## Open Questions

- None blocking. (Lint tooling choice — eslint vs biome — deferred to a later change; this change only needs typecheck to pass.)
