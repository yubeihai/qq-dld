# Comet Design Handoff

- Change: monorepo-scaffolding
- Phase: design
- Mode: compact
- Context hash: a796b0713de76152d8488f3c78818ecfe2c3cfafc19bd6d6130b38aae22c77d5

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/monorepo-scaffolding/proposal.md

- Source: openspec/changes/monorepo-scaffolding/proposal.md
- Lines: 1-30
- SHA256: e81a676b9d57b5ac03bf9ddd0e3a8b8e78c0c71b0dc542932d3146177f5f471b

```md
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

```

## openspec/changes/monorepo-scaffolding/design.md

- Source: openspec/changes/monorepo-scaffolding/design.md
- Lines: 1-85
- SHA256: 4cc2b474b9d6dc570dd8b396b1ee7d467a16b72626459a7ac1e50aea0e53014c

[TRUNCATED]

```md
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

```

Full source: openspec/changes/monorepo-scaffolding/design.md

## openspec/changes/monorepo-scaffolding/tasks.md

- Source: openspec/changes/monorepo-scaffolding/tasks.md
- Lines: 1-42
- SHA256: db9dd70c206c61464c6b0a370a1f3bafff5919a54dcfd9d1ade3ac64e129530e

```md
## 1. Root workspace configuration

- [ ] 1.1 Add `workspaces` field to root `package.json` enumerating `packages/shared`, `packages/server`, `packages/web` (in dependency order)
- [ ] 1.2 Add root orchestration scripts (`build`, `typecheck`, `dev:workspaces`) distinct from legacy `start`/`stop`/`dev`; preserve legacy scripts pointing at `src/web/index.js`
- [ ] 1.3 Add root devDependencies: `typescript`, `@types/node`; keep existing legacy runtime deps on root for `src/` app
- [ ] 1.4 Run `npm install` at root and verify workspaces are recognized (junctions/hoisting) with no errors

## 2. TypeScript configuration hierarchy

- [ ] 2.1 Create `tsconfig.base.json` at root with shared compiler options (strict, target ES2022, module CommonJS, moduleResolution Node, declaration, declarationMap, sourceMap)
- [ ] 2.2 Create root `tsconfig.json` referencing `packages/shared` and `packages/server` only (NOT web) for `tsc --build`
- [ ] 2.3 Create `packages/shared/tsconfig.json` extending base (composite, outDir dist, rootDir src)
- [ ] 2.4 Create `packages/server/tsconfig.json` extending base with `references` to `shared` (composite, Node libs, outDir dist)
- [ ] 2.5 Create `packages/web/tsconfig.json` extending base (DOM libs, module ESNext, moduleResolution Bundler, noEmit true; NOT composite, NOT in tsc --build)
- [ ] 2.6 Verify `tsc --build` at root typechecks shared+server with no errors; verify `vue-tsc --noEmit -p packages/web/tsconfig.json` typechecks web

## 3. packages/shared skeleton

- [ ] 3.1 Create `packages/shared/package.json` (name `@qq-dld/shared`, `main`/`types` entry, `build` script using tsc, `typecheck` script)
- [ ] 3.2 Create `packages/shared/src/index.ts` re-exporting domain types
- [ ] 3.3 Define domain type declarations: `Account`, `Module`, `ModuleConfig`, `ExecLog`, `Friend`, `TaskConfig`, `SchedulerJob`
- [ ] 3.4 Run `npm run build -w @qq-dld/shared` and verify CJS output + `.d.ts` emitted

## 4. packages/server skeleton

- [ ] 4.1 Create `packages/server/package.json` (name `@qq-dld/server`, `build` via tsc -> CJS, `typecheck`, `dev` watch script)
- [ ] 4.2 Create `packages/server/src/index.ts` importing a type from `@qq-dld/shared` and logging a startup line
- [ ] 4.3 Run `npm run build -w @qq-dld/server` and verify CJS output runs via `node` without error

## 5. packages/web skeleton

- [ ] 5.1 Create `packages/web/package.json` (name `@qq-dld/web`, `build` via vite + vue-tsc typecheck, `dev` via vite, `typecheck` via vue-tsc)
- [ ] 5.2 Create `packages/web/vite.config.ts` and `index.html`
- [ ] 5.3 Create `packages/web/src/main.ts` importing a type from `@qq-dld/shared` and mounting an empty Vue3 app with Vant4 installed
- [ ] 5.4 Run `npm run build -w @qq-dld/web` and verify Vite produces `dist/` without errors

## 6. Cross-package verification

- [ ] 6.1 Verify `npm run build` (root orchestration) builds all three workspaces in dependency order
- [ ] 6.2 Verify `npm run typecheck` (root) runs `tsc --build` (shared+server) and `vue-tsc --noEmit` (web) with no errors
- [ ] 6.3 Verify `npm start` still launches the legacy `src/web/index.js` Express app unchanged
- [ ] 6.4 Verify rollback path is clean: `packages/` and root tsconfigs are the only new artifacts; no `src/`, `public/`, or `data/` files modified

```

## openspec/changes/monorepo-scaffolding/specs/monorepo-structure/spec.md

- Source: openspec/changes/monorepo-scaffolding/specs/monorepo-structure/spec.md
- Lines: 1-56
- SHA256: e5bfa749800fd46c44a9825a247e5118b3a1f02a44899164fa43e1a17e444dc1

```md
## ADDED Requirements

### Requirement: Monorepo workspaces layout
The repository SHALL be organized as an npm workspaces monorepo with three workspace packages located at `packages/server`, `packages/shared`, and `packages/web`. The root `package.json` SHALL declare a `workspaces` field enumerating these three packages in dependency order (`shared`, `server`, `web`).

#### Scenario: Workspaces recognized by npm
- **WHEN** `npm install` is run at the repository root
- **THEN** npm SHALL install all three workspace packages and hoist shared dependencies into the root `node_modules`

#### Scenario: Legacy app still runnable
- **WHEN** `npm start` is run at the repository root
- **THEN** the legacy Express app at `src/web/index.js` SHALL continue to start without error, unchanged from before this change

### Requirement: TypeScript configuration hierarchy with project references
The repository SHALL provide a base TypeScript config (`tsconfig.base.json`) at the root holding shared compiler options (strict mode, ES2022 target, CommonJS module, Node moduleResolution, declaration emit). Each workspace package SHALL extend the base config via `"extends"`. `packages/server` SHALL declare a project `reference` to `packages/shared`. The root SHALL provide a `tsconfig.json` referencing `packages/shared` and `packages/server` so `tsc --build` typechecks and emits those two packages in dependency order. `packages/web` SHALL NOT be part of the `tsc --build` graph (Vue SFCs require Volar-based typechecking and web's `noEmit` conflicts with composite's declaration-emit requirement); it SHALL be typechecked separately via `vue-tsc --noEmit`.

#### Scenario: Cross-package typecheck
- **WHEN** the root typecheck script is run
- **THEN** `tsc --build` SHALL typecheck `packages/shared` and `packages/server` with no errors, building `shared` before `server` per the reference graph, and `vue-tsc --noEmit` SHALL typecheck `packages/web` with no errors

#### Scenario: Web package uses DOM libs
- **WHEN** the `packages/web` TypeScript config is inspected
- **THEN** it SHALL include DOM `lib` entries appropriate for a browser target, distinct from the server package which SHALL use Node-appropriate libs

### Requirement: Per-package build tooling
Each workspace package SHALL have a `build` script in its `package.json` that compiles its TypeScript source to runnable output. `packages/server` and `packages/shared` SHALL build using `tsc` emitting CommonJS output (`.js` + `.d.ts`). `packages/web` SHALL build using Vite and typecheck via `vue-tsc`. Each package SHALL also expose a `typecheck` script.

#### Scenario: Build all workspaces
- **WHEN** `npm run build --workspaces` is run at the repository root
- **THEN** every workspace SHALL build successfully in `workspaces` array order (`shared`, then `server`, then `web`), each producing its declared output without errors

#### Scenario: Server emits CommonJS
- **WHEN** the `packages/server` build output is inspected
- **THEN** it SHALL be CommonJS modules consumable by `require()` in Node.js

### Requirement: Shared types package contract
`packages/shared` SHALL export TypeScript domain type declarations (no runtime values) covering the forward-looking domain model: `Account`, `Module`, `ModuleConfig`, `ExecLog`, `Friend`, `TaskConfig`, and `SchedulerJob`. `packages/server` and `packages/web` SHALL be able to import these types across the workspace boundary.

#### Scenario: Import shared type from server
- **WHEN** `packages/server/src/index.ts` imports a type from `@qq-dld/shared` (the shared package name)
- **THEN** the import SHALL resolve and typecheck successfully

#### Scenario: Import shared type from web
- **WHEN** `packages/web/src/main.ts` imports a type from `@qq-dld/shared`
- **THEN** the import SHALL resolve and typecheck successfully

### Requirement: Root orchestration scripts
The root `package.json` SHALL provide orchestration scripts that operate across all workspaces: a `build` script that builds every workspace via `npm run build --workspaces`, a `typecheck` script that runs `tsc --build` over the `shared`+`server` project-reference graph and `vue-tsc --noEmit` over `packages/web`, and a `dev:workspaces` script that runs the server (watch) and web (vite dev) concurrently. These scripts SHALL be distinct from the legacy `start`/`stop`/`dev` scripts that run the `src/` Express app.

#### Scenario: Root build orchestrates workspaces
- **WHEN** `npm run build` is run at the repository root (the workspace orchestration script)
- **THEN** all three workspace packages SHALL build in `workspaces` array order without errors

#### Scenario: Legacy scripts preserved
- **WHEN** the root `package.json` scripts are inspected
- **THEN** a script that starts the legacy `src/web/index.js` app SHALL still be present and functional, separate from the new workspace orchestration scripts

```
