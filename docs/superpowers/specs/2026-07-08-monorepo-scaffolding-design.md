---
comet_change: monorepo-scaffolding
role: technical-design
canonical_spec: openspec
archived-with: 2026-07-09-monorepo-scaffolding
status: final
---

# Technical Design: monorepo-scaffolding

> Canonical spec: `openspec/changes/monorepo-scaffolding/specs/monorepo-structure/spec.md`
> Open-phase design: `openspec/changes/monorepo-scaffolding/design.md`
> Brainstorm summary: `openspec/changes/monorepo-scaffolding/.comet/handoff/brainstorm-summary.md`

## 1. Context

qq-dld is currently a single-package CommonJS Node.js app (Express + sql.js + puppeteer-core + single-page HTML). This is the first of 6 sequential changes to migrate the project to TypeScript + Fastify + Vue3 + Vant4 + better-sqlite3 with multi-account support, JWT auth, and a layered architecture (parser/service/repository/data).

This change creates **only the monorepo skeleton** — npm workspaces, TypeScript configuration, per-package build tooling, and a shared types package. No business logic is migrated. The legacy `src/` Express app must continue to run unchanged.

## 2. Goals & Non-Goals

**Goals**
- Establish 3 npm workspaces: `packages/server`, `packages/shared`, `packages/web`
- Set up TypeScript with project references and incremental builds
- Each workspace builds independently and as part of root orchestration
- `packages/shared` exports domain type skeletons consumed by server + web
- Legacy `npm start` / `npm stop` / `npm dev` continue to work untouched

**Non-Goals**
- Migrate any business logic, routes, database, or game modules
- Add Fastify, better-sqlite3, JWT, or multi-account (later changes)
- Add lint tooling (deferred)
- Add unit tests (scaffolding is build-time verified only)

## 3. Decisions

### D1 — Three workspaces: server / shared / web

Workspace | Purpose | Consumers
---|---|---
`packages/shared` | Domain type definitions (Account, Module, ModuleConfig, ExecLog, Friend, TaskConfig, SchedulerJob) — types only, no runtime logic | server + web
`packages/server` | Future Fastify API server (empty skeleton this change) | root
`packages/web` | Vue3 + Vant4 frontend (minimal mount this change) | root

**Rejected:** 2 workspaces (server+web sharing types inline → type drift); 4 workspaces (separate `data` package → data is server-internal, not a published boundary).

### D2 — TypeScript project references (shared + server only)

`tsconfig.base.json` holds shared compiler options. The **root** `tsconfig.json` uses `references` to `packages/shared` and `packages/server` only — **NOT** `packages/web`. `tsc --build` at root typechecks shared + server incrementally.

**Web is typechecked separately** via `vue-tsc --noEmit` (its own `typecheck` script). Vue SFC type-checking requires `vue-tsc`, which is incompatible with `tsc --build` composite mode.

```
tsconfig.base.json          # shared compiler options
├── tsconfig.json (root)    # references: [shared, server], no files
├── packages/shared/tsconfig.json   # extends base, composite, outDir dist
├── packages/server/tsconfig.json   # extends base, composite, references [shared], outDir dist
└── packages/web/tsconfig.json      # extends base, noEmit, NOT composite, vue-tsc
```

**Rejected:** Include web in `tsc --build` (vue-tsc incompatibility with composite; `.vue` files not recognized by tsc).

### D3 — tsc emit for server + shared (not tsup)

Server and shared build via `tsc` emitting CommonJS `.js` + `.d.ts` to `dist/`. 

**Why not tsup (esbuild):** Later changes introduce `better-sqlite3` (native `.node` addon) and `puppeteer-core` to the server. esbuild-based bundlers cannot bundle native addons — they must remain external. tsc emit (transpile-only, no bundling) avoids this entirely. tsup with `--no-bundle` is equivalent to tsc emit but adds a dependency for no benefit. tsup is retained as a future build-speed optimization if needed.

**Web** builds via Vite (ESM, tree-shaking, HMR for dev). Typechecking via `vue-tsc --noEmit`.

### D4 — Dependency placement

- **Root devDependencies:** `typescript`, `@types/node` only (shared by all workspaces via hoisting)
- **Per-package dependencies:** each workspace declares its own runtime deps in its `package.json`
  - shared: none (types only)
  - server: none this change (Fastify etc. in later change)
  - web: `vue`, `vant`, devDeps `vite`, `vue-tsc`, `@vitejs/plugin-vue`, `typescript`
- **Legacy deps** (express, sql.js, axios, node-schedule, puppeteer-core) stay on root `package.json` for the legacy `src/` app

### D5 — Root orchestration scripts

Script | Command | Notes
---|---|---
`build` | `npm run build --workspaces` | npm runs workspaces in `workspaces` array order: shared → server → web
`typecheck` | `tsc --build && npm run typecheck -w packages/web` | shared+server via tsc, web via vue-tsc
`dev:workspaces` | concurrently run dev in each workspace | (concurrently installed as root devDep if needed, or simple `npm run dev --workspaces`)
`start` / `stop` / `dev` | unchanged | legacy `src/` app — preserved, not modified

### D6 — Shared package contract

`packages/shared` exports type-only skeletons for 7 domain entities. These are **interface contracts** that server and web both depend on — establishing the cross-package type boundary early. No runtime logic. Built via tsc to `dist/` with `.d.ts` + empty `.js` stubs (type-only exports produce no runtime code, but module resolution requires the package to resolve).

```typescript
// packages/shared/src/index.ts
export type { Account } from './types/account';
export type { Module, ModuleConfig } from './types/module';
// ... etc
```

## 4. Risks & Trade-offs

| Risk | Mitigation |
|---|---|
| Mixed-purpose root package.json (legacy app + workspaces root) | Distinct script namespaces; legacy scripts untouched; new scripts prefixed differently |
| npm hoisting on Windows | npm 9+ uses junctions (not symlinks) on Windows; verify `npm install` succeeds |
| Project reference build order | `references` in tsconfig encodes shared→server dependency; `workspaces` array order encodes shared→server→web for npm |
| Web not in tsc --build | Separate `vue-tsc` typecheck; documented in spec; root `typecheck` script chains both |

## 5. Migration Plan

1. Add `workspaces` field to root `package.json` (array order: shared, server, web — dependency order)
2. Add root devDependencies: `typescript`, `@types/node`; run `npm install`
3. Create `tsconfig.base.json` + root `tsconfig.json` (references shared + server)
4. Create `packages/shared/` (package.json, tsconfig, src/index.ts + 7 type files) → verify `tsc --build` for shared
5. Create `packages/server/` (package.json, tsconfig referencing shared, src/index.ts) → verify `tsc --build` for server
6. Create `packages/web/` (package.json, tsconfig, vite.config, index.html, src/main.ts mounting Vue3+Vant4) → verify `vite build` + `vue-tsc`
7. Add root scripts (build, typecheck, dev:workspaces) → verify `npm run build` + `npm run typecheck`
8. Verify legacy `npm start` still works

**Rollback:** `git checkout -- package.json package-lock.json && rm -rf packages/ tsconfig*.json docs/superpowers/`

## 6. Test Strategy

No unit tests — scaffolding is pure infrastructure. Verification is build-time:
- `npm install` succeeds (workspaces recognized)
- `tsc --build` passes (shared + server typecheck, incremental)
- `vue-tsc --noEmit` passes (web typecheck)
- `npm run build` builds all 3 workspaces
- `npm start` launches legacy app (unchanged)
- `import { Account } from '@qq-dld/shared'` resolves in both server and web

## 7. Open Questions

- **Lint tooling** (ESLint/Prettier): deferred to a later change. Not needed for scaffolding.
- **Concurrently** for `dev:workspaces`: may need `concurrently` as root devDep, or use `npm run dev --workspaces` (runs sequentially). Decide during build.

