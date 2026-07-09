---
change: monorepo-scaffolding
design-doc: docs/superpowers/specs/2026-07-08-monorepo-scaffolding-design.md
base-ref: 0f5e5c9ec9c65560be6b30f4c5d6b6810f253519
archived-with: 2026-07-09-monorepo-scaffolding
---

# Implementation Plan: monorepo-scaffolding

> Design doc: `docs/superpowers/specs/2026-07-08-monorepo-scaffolding-design.md`
> Tasks: `openspec/changes/monorepo-scaffolding/tasks.md`
> Canonical spec: `openspec/changes/monorepo-scaffolding/specs/monorepo-structure/spec.md`
> Base ref: `0f5e5c9ec9c65560be6b30f4c5d6b6810f253519` (dev branch)

## 0. Goal of this change

Build **only the monorepo skeleton**: 3 npm workspaces, TypeScript project-reference config, per-package build tooling, and a shared types package with 7 domain type skeletons. **No business logic is migrated.** The legacy `src/` Express app must continue to run unchanged from `npm start`.

After this change the following must be true:
- `npm install` recognizes all 3 workspaces and hoists devDeps (Windows junctions, npm 9+).
- `tsc --build` (root) typechecks `shared` + `server` incrementally with no errors.
- `vue-tsc --noEmit -p packages/web/tsconfig.json` typechecks `web` with no errors.
- `npm run build --workspaces` builds all 3 packages in array order (shared → server → web).
- `npm run typecheck` (root) runs both `tsc --build` and the web vue-tsc step.
- `npm start` still launches `src/web/index.js` untouched.
- `import type { Account } from '@qq-dld/shared'` resolves in both server and web.

## 0.1 Environment & conventions

- Platform: Windows (PowerShell 5.1 / npm 9+). Use `Remove-Item -Recurse -Force` not `rm -rf`.
- Node.js + npm only — no pnpm/yarn. Workspaces rely on npm's junction-based hoisting (no symlinks).
- All new TS config uses `extends`; package-specific overrides live in package tsconfigs only.
- No comments in generated TS/JSON unless required by the tool (Vue SFCs, etc.).
- Legacy `src/`, `public/`, `data/` directories and root `package.json` legacy deps are NOT modified. Only additive fields are appended to root `package.json`.
- CommonJS (`require`) is preserved for `shared` + `server` outputs ( mirroring the existing `src/` app which is CJS). Web is ESM (Vite).

## 0.2 Execution order (hard dependencies)

```
Group 1 (root package.json fields, workspaces, devDeps)
   ↓ requires npm install
Group 2 (tsconfig.base.json + root tsconfig.json + 3 package tsconfigs)
   ↓ requires tsc to be on PATH (hoisted after Group 1 install)
Group 3 (packages/shared source + package.json)   ← independent of 4,5
Group 4 (packages/server source + package.json)   ← imports from shared (needs Group 3 built, or project refs)
Group 5 (packages/web source + vite + package.json)← imports from shared
Group 6 (root scripts + cross-package verification)← needs 3,4,5 done
```

Group 3 and 5 are independent and could be done in parallel; Group 4 depends on shared types being resolvable (project references make this work at typecheck time even before `shared/dist` is built, but `server` runtime build requires `shared/dist` to exist — so build shared first, or rely on `tsc --build` to transitively build shared).

archived-with: 2026-07-09-monorepo-scaffolding
---

## Group 1 — Root workspace configuration

**Objective:** turn the single-package root into an npm workspaces root while leaving legacy deps and scripts intact.

### 1.1 Modify `package.json` (root, additive only)

File: `C:\Users\中科华汇\Desktop\qq-dld\package.json`

Current state (must preserve):
```json
{
  "name": "qq-dld",
  "version": "2.0.0",
  "description": "QQ 大乐斗自动任务系统 (开发中)",
  "main": "src/web/index.js",
  "scripts": {
    "start": "node src/web/index.js",
    "stop": "node stop.js",
    "dev": "node src/web/index.js"
  },
  "dependencies": {
    "@fission-ai/openspec": "^1.5.0",
    "@rpamis/comet": "^0.4.0-beta.2",
    "axios": "^1.6.7",
    "express": "^4.18.2",
    "node-schedule": "^2.1.1",
    "puppeteer-core": "^22.6.4",
    "sql.js": "^1.10.3"
  },
  "devDependencies": {
    "@playwright/test": "^1.58.2"
  }
}
```

Changes:
1. **Add `workspaces` array** (order matters — dependency order: `shared` first, then `server`, then `web`):
   ```json
   "workspaces": ["packages/shared", "packages/server", "packages/web"]
   ```
2. **Add `private: true`** (root is not published; npm workspaces roots should be private). — *Decision: optional but recommended. If `npm publish` warnings on legacy scripts are a concern, set it. Keep `main` field as `src/web/index.js` for the legacy app.*
3. **Add `devDependencies`** for TypeScript tooling (hoisted across workspaces):
   ```json
   "typescript": "^5.4.5",
   "@types/node": "^20.12.7"
   ```
   Keep existing `@playwright/test` devDep.
4. **Do NOT add root `scripts.build`/`typecheck`/`dev:workspaces` here** — those are added in Group 6 once per-package scripts exist (avoids `npm run build` failing against not-yet-created workspaces during intermediate installs). Legacy `start`/`stop`/`dev` stay unchanged.

Resulting root `package.json` (final, after Group 6 adds scripts):
- `scripts.start` = `node src/web/index.js` (unchanged)
- `scripts.stop` = `node stop.js` (unchanged)
- `scripts.dev` = `node src/web/index.js` (unchanged)
- `scripts.build` = `npm run build --workspaces` (added in Group 6)
- `scripts.typecheck` = `tsc --build --force && vue-tsc --noEmit -p packages/web/tsconfig.json` (added in Group 6)
- `scripts.dev:workspaces` = `npm run dev --workspaces` (added in Group 6; note: runs sequentially in workspaces array order — acceptable for skeleton)
- `dependencies` (legacy): unchanged
- `devDependencies`: `@playwright/test`, `typescript`, `@types/node`

### 1.2 Create `packages/` directory structure

Run (PowerShell, from repo root):
```powershell
New-Item -ItemType Directory -Path "packages\shared\src\types" -Force
New-Item -ItemType Directory -Path "packages\server\src" -Force
New-Item -ItemType Directory -Path "packages\web\src" -Force
```

### 1.3 Update `.gitignore`

File: `C:\Users\中科华汇\Desktop\qq-dld\.gitignore`

Add (so built artifacts don't get committed):
```
# TypeScript build output
packages/*/dist/
packages/*/tsconfig.tsbuildinfo
*.tsbuildinfo

# Vite build output (web)
packages/web/dist/
```
Verify `node_modules/` and `data/` are already ignored.

### 1.4 Verify Group 1

```powershell
npm install
```
**Expected:** install succeeds; `node_modules/` hoists `typescript`; `node_modules/@qq-dld/shared` etc. are junctions back to `packages/*`. No workspace warnings.
```powershell
npm ls --workspaces
```
**Expected:** lists `@qq-dld/shared`, `@qq-dld/server`, `@qq-dld/web` with `(empty)` placeholders (package.jsons don't yet exist — npm will show them as missing until Group 3-5 package.json are created; that is OK at this step, but `npm install` itself should not error).

> ⚠ If `npm install` errors with `ENOENT` for workspace `package.json`, you can either (a) create empty placeholder `package.json` files in each `packages/*` now (`{ "name": "...", "version": "0.0.0" }`), or (b) defer `npm install` until after Group 2-5 create the package.json files. Recommended: create placeholder package.json files in each package now to satisfy `npm install`, then overwrite them in Groups 3-5. Decision: **create placeholders** — keeps `tsconfig.base.json` of Group 2 from being blocked by missing workspace package.json.

Placeholder files to create now:
- `packages/shared/package.json` → `{ "name": "@qq-dld/shared", "version": "0.0.0", "private": true }`
- `packages/server/package.json` → `{ "name": "@qq-dld/server", "version": "0.0.0", "private": true }`
- `packages/web/package.json` → `{ "name": "@qq-dld/web", "version": "0.0.0", "private": true }`

archived-with: 2026-07-09-monorepo-scaffolding
---

## Group 2 — TypeScript configuration hierarchy

**Objective:** define the shared compiler options and the project-reference graph. After this group, `npx tsc --build` should run (showing expected "no inputs found" errors until source files exist in Group 3-5).

### 2.1 Create `tsconfig.base.json` (root)

File: `C:\Users\中科华汇\Desktop\qq-dld\tsconfig.base.json`

Content (shared compiler options extended by all package tsconfigs):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

Key decisions:
- `target: ES2022` matches Node 18+ runtime.
- `module: CommonJS` / `moduleResolution: Node` for shared+server (matches legacy CJS app). Web overrides to `ESNext`/`Bundler` in 2.5.
- `lib: ["ES2022"]` is the base; web adds DOM libs in its override.
- `declaration` + `declarationMap` + `sourceMap` emit enabled globally; packages that emit set `composite: true`, web sets `noEmit: true`.
- `noUnusedLocals` / `noUnusedParameters` ON from day one (strictness is cheap on empty skeletons).

### 2.2 Create root `tsconfig.json` (project references)

File: `C:\Users\中科华汇\Desktop\qq-dld\tsconfig.json`

Content:
```json
{
  "files": [],
  "references": [
    { "path": "./packages/shared" },
    { "path": "./packages/server" }
  ]
}
```

Key decisions:
- `files: []` — root tsconfig is a **solution-style** config; it does not itself compile anything, only orchestrates `tsc --build` over referenced projects.
- **`packages/web` is NOT referenced** here (per D2). Vue SFCs require Volar / vue-tsc and `.vue` files are invisible to plain `tsc`. Web is typechecked separately (Group 5 + Group 6 root `typecheck` script).

### 2.3 Create `packages/shared/tsconfig.json`

File: `C:\Users\中科华汇\Desktop\qq-dld\packages\shared\tsconfig.json`

Content:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist",
    "tsBuildInfoFile": "tsconfig.tsbuildinfo"
  },
  "include": ["src/**/*"]
}
```

Key decisions:
- `composite: true` (required for project references + incremental emit).
- `rootDir: src`, `outDir: dist` → emits to `packages/shared/dist/`, mirrored structure.
- `tsBuildInfoFile` local to the package for incremental cache isolation.

### 2.4 Create `packages/server/tsconfig.json`

File: `C:\Users\中科华汇\Desktop\qq-dld\packages\server\tsconfig.json`

Content:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist",
    "tsBuildInfoFile": "tsconfig.tsbuildinfo",
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "references": [
    { "path": "../shared" }
  ],
  "include": ["src/**/*"]
}
```

Key decisions:
- `references: [{ path: "../shared" }]` — establishes shared → server build order at the tsc level (independent of npm `workspaces` array).
- `types: ["node"]` — pulls `@types/node` (hoisted at root) for server Node runtime types.
- `lib: ["ES2022"]` — server uses Node-only libs (no DOM).

### 2.5 Create `packages/web/tsconfig.json`

File: `C:\Users\中科华汇\Desktop\qq-dld\packages\web\tsconfig.json`

Content:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": false,
    "noEmit": true,
    "rootDir": "src",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": [],
    "jsx": "preserve",
    "useDefineForClassFields": true
  },
  "include": ["src/**/*", "src/**/*.vue", "vite.config.ts", "index.html"]
}
```

Key decisions:
- **NOT composite**, **NOT referenced** from root tsconfig (per D2). typechecked by `vue-tsc --noEmit` only.
- `module: ESNext` / `moduleResolution: Bundler` — Vite-native resolution; required for `import type { X } from '@qq-dld/shared'` resolution in a bundler context.
- `lib` adds `DOM` + `DOM.Iterable` (browser target, distinct from server per spec scenario "Web package uses DOM libs").
- `noEmit: true` — Vite produces the actual `dist/`, vue-tsc only typechecks.
- `jsx: preserve` — Vite handles JSX/SFC transform; standard for Vue3.
- `types: []` — don't auto-include `@types/node`; web is browser-only.

### 2.6 Verify Group 2

At this point `packages/*/src` is empty, so `tsc --build` will error "No inputs were found". That is **expected** and only means the tsconfig chain is wired correctly. To validate the chain itself:
```powershell
npx tsc --showConfig -p packages/shared/tsconfig.json
npx tsc --showConfig -p packages/server/tsconfig.json
npx tsc --showConfig -p packages/web/tsconfig.json
```
**Expected:** each prints a fully-resolved config object extending base, no schema errors. Shared+server show `composite: true`; web shows `noEmit: true` and `lib` including DOM entries.

Do NOT run `npx tsc --build` yet (will fail on empty src). Defer to Group 3.4.

archived-with: 2026-07-09-monorepo-scaffolding
---

## Group 3 — `packages/shared` skeleton

**Objective:** the type-only contract package imported by both server and web.

### 3.1 Overwrite `packages/shared/package.json`

File: `C:\Users\中科华汇\Desktop\qq-dld\packages\shared\package.json`

Content:
```json
{
  "name": "@qq-dld/shared",
  "version": "0.0.0",
  "private": true,
  "description": "Shared domain type definitions for qq-dld workspaces",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc --build",
    "typecheck": "tsc --noEmit --build"
  },
  "files": ["dist"]
}
```

Key decisions:
- `private: true` — never published; only consumed inside the workspaces graph.
- `main`/`types`/`exports` point at `dist/` — both server (Node require) and web (Vite + `moduleResolution: Bundler`) resolve via `exports`. Providing both `types` and `default` conditions guarantees resolution under either toolchain.
- No runtime deps (per D4). No devDeps (typescript hoisted at root).
- `build` uses `tsc --build` (composite-aware; respects project references + incremental cache).
- `typecheck` uses `tsc --noEmit --build` for fast non-emitting typecheck.

### 3.2 Create `packages/shared/src/index.ts`

File: `C:\Users\中科华汇\Desktop\qq-dld\packages\shared\src\index.ts`

Content:
```ts
export type { Account } from './types/account';
export type { Module, ModuleConfig } from './types/module';
export type { ExecLog } from './types/exec-log';
export type { Friend } from './types/friend';
export type { TaskConfig } from './types/task-config';
export type { SchedulerJob } from './types/scheduler-job';
```

Key decisions:
- `export type` — type-only re-exports; produces no runtime code (matches D6: "no runtime logic").
- Single barrel file; exact 7 types per spec scenario: `Account`, `Module`, `ModuleConfig`, `ExecLog`, `Friend`, `TaskConfig`, `SchedulerJob`.

### 3.3 Create domain type declaration files

One file per type (per AGENTS.md structure convention and D6). All are **skeleton/interface contracts** — fields reflect the forward-looking domain model (mirrors existing SQLite tables from the legacy `src/db` schema). Keep them minimal but representative so downstream migrations later can extend them.

Each file uses `export interface ...` (open for extension by later changes).

#### `packages/shared/src/types/account.ts`
File: `C:\Users\中科华汇\Desktop\qq-dld\packages\shared\src\types\account.ts`
```ts
export interface Account {
  id: number;
  nickname: string;
  uin?: string;
  cookie?: string;
  status: 'active' | 'disabled' | 'expired';
  createdAt: string;
  updatedAt: string;
}
```

#### `packages/shared/src/types/module.ts`
File: `C:\Users\中科华汇\Desktop\qq-dld\packages\shared\src\types\module.ts`
```ts
export interface Module {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
}

export interface ModuleConfig {
  id: number;
  moduleId: string;
  accountId: number;
  config: Record<string, unknown>;
  enabled: boolean;
}
```

#### `packages/shared/src/types/exec-log.ts`
File: `C:\Users\中科华汇\Desktop\qq-dld\packages\shared\src\types\exec-log.ts`
```ts
export interface ExecLog {
  id: number;
  moduleId: string;
  accountId: number;
  status: 'success' | 'fail' | 'partial';
  result?: string;
  error?: string;
  createdAt: string;
}
```

#### `packages/shared/src/types/friend.ts`
File: `C:\Users\中科华汇\Desktop\qq-dld\packages\shared\src\types\friend.ts`
```ts
export interface Friend {
  id: number;
  uin: string;
  nickname: string;
  level?: number;
  foughtToday: boolean;
}
```

#### `packages/shared/src/types/task-config.ts`
File: `C:\Users\中科华汇\Desktop\qq-dld\packages\shared\src\types\task-config.ts`
```ts
export interface TaskConfig {
  id: number;
  taskTypeId: string;
  accountId: number;
  cron: string;
  enabled: boolean;
  params: Record<string, unknown>;
}
```

#### `packages/shared/src/types/scheduler-job.ts`
File: `C:\Users\中科华汇\Desktop\qq-dld\packages\shared\src\types\scheduler-job.ts`
```ts
export interface SchedulerJob {
  id: string;
  taskConfigId: number;
  nextRunAt: string;
  running: boolean;
}
```

### 3.4 Verify Group 3

```powershell
npx tsc --build packages/shared/tsconfig.json
```
**Expected:** exits 0; creates `packages/shared/dist/` containing:
- `index.js` (and `index.d.ts`, `index.d.ts.map`, `index.js.map`)
- `types/account.js` + `types/account.d.ts` + maps (and same for the other 5 type files)

Note: type-only exports of interfaces produce empty `.js` stubs (`Object.defineProperty(exports, ...)` module-marker only) but real `.d.ts` declarations — that is the intended D6 behavior.

```powershell
npm run build -w @qq-dld/shared
```
**Expected:** same as above, run through the package's `build` script.

Reset incremental cache for clean re-runs if needed:
```powershell
Remove-Item -Recurse -Force packages\shared\dist,packages\shared\tsconfig.tsbuildinfo -ErrorAction SilentlyContinue
```

archived-with: 2026-07-09-monorepo-scaffolding
---

## Group 4 — `packages/server` skeleton

**Objective:** empty CJS server skeleton that imports a type from `@qq-dld/shared` and logs a startup line. No Fastify/HTTP/db this change (deferred per D3 + design §2 Non-Goals).

### 4.1 Overwrite `packages/server/package.json`

File: `C:\Users\中科华汇\Desktop\qq-dld\packages\server\package.json`

Content:
```json
{
  "name": "@qq-dld/server",
  "version": "0.0.0",
  "private": true,
  "description": "Fastify API server workspace (skeleton)",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc --build",
    "typecheck": "tsc --noEmit --build",
    "dev": "tsc --build --watch",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@qq-dld/shared": "0.0.0"
  },
  "files": ["dist"]
}
```

Key decisions:
- `dependencies: { "@qq-dld/shared": "0.0.0" }` — workspace dep. npm rewrites this to a `file:` link / junction at install time. The version must match the version field on `@qq-dld/shared`'s package.json (we used `0.0.0` in Group 3.1; keep them in lockstep).
- No runtime framework deps yet (Fastify etc. come in a later change per design §2 Non-Goals).
- `dev` uses `tsc --build --watch` (composite-aware watch; faster than raw watch for small packages). Simple, tooling-free.
- `start` runs the built `dist/index.js` (for ad-hoc smoke tests; not part of root orchestration).

### 4.2 Create `packages/server/src/index.ts`

File: `C:\Users\中科华汇\Desktop\qq-dld\packages\server\src\index.ts`

Content:
```ts
import type { Account } from '@qq-dld/shared';

const sampleAccount: Account = {
  id: 1,
  nickname: 'sample',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

console.log('[qq-dld/server] skeleton ready', sampleAccount.nickname);
```

Key decisions:
- `import type { Account }` — type-only import (matches D6 + spec scenario "Import shared type from server"). Proves cross-workspace type resolution.
- `noUnusedLocals` is ON (base config), so `sampleAccount` MUST be used — hence the `console.log`.
- Single file, no directory tree; later changes add `parser/`, `service/`, `repository/`, `data/` directories.

### 4.3 Verify Group 4

Prerequisite: `@qq-dld/shared` must resolve. Two paths:
1. (preferred) `npm install` already linked `packages/shared` into root `node_modules/@qq-dld/shared` after Group 3.1's `package.json` was created with the correct `name`. If you skipped re-running `npm install` after Group 3.1, run it now:
   ```powershell
   npm install
   ```
2. `tsc --build` will also build the referenced `shared` package transitively, so even without the node_modules link the project-reference graph resolves via `references`.

```powershell
npx tsc --build
```
**Expected:** builds `shared` (if stale) then `server`; exits 0; creates `packages/server/dist/index.js` + `.d.ts` + maps.

```powershell
npm run build -w @qq-dld/server
node packages\server\dist\index.js
```
**Expected:** logs `[qq-dld/server] skeleton ready sample` and exits 0. Confirms CJS output runs in Node (spec scenario "Server emits CommonJS").

archived-with: 2026-07-09-monorepo-scaffolding
---

## Group 5 — `packages/web` skeleton

**Objective:** minimal Vue 3 + Vant 4 SPA that imports a type from `@qq-dld/shared`, mounts Vant, and builds via Vite with `vue-tsc` typecheck.

### 5.1 Add root devDependencies (hoisted, web-only runtime)

Per D4: web's runtime deps (`vue`, `vant`) and devDeps (`vite`, `vue-tsc`, `@vitejs/plugin-vue`, `@vue/tsconfig`, `@vue/runtime-core` if needed) are declared **per-package on `packages/web/package.json`**, NOT at root. (Re-reading D4 carefully: *"hoist shared devDeps to root, per-package runtime deps"* and migration plan step 6 says web deps live in `packages/web/package.json`.) Decision: **place web's deps on `packages/web/package.json`**, run `npm install -w @qq-dld/web` to install only into that workspace (npm hoists to root by default).

### 5.2 Overwrite `packages/web/package.json`

File: `C:\Users\中科华汇\Desktop\qq-dld\packages\web\package.json`

Content:
```json
{
  "name": "@qq-dld/web",
  "version": "0.0.0",
  "private": true,
  "description": "Vue3 + Vant4 web frontend workspace",
  "type": "module",
  "scripts": {
    "build": "vue-tsc --noEmit -p tsconfig.json && vite build",
    "typecheck": "vue-tsc --noEmit -p tsconfig.json",
    "dev": "vite"
  },
  "dependencies": {
    "@qq-dld/shared": "0.0.0",
    "vue": "^3.4.27",
    "vant": "^4.9.1"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.4",
    "vite": "^5.2.11",
    "vue-tsc": "^2.0.19"
  },
  "files": ["dist"]
}
```

Key decisions:
- `"type": "module"` — web is ESM (Vite-native). Distinct from `shared`/`server` (CJS).
- `build` runs `vue-tsc --noEmit` first (fail fast on type errors), then `vite build`. The `&&` chain ensures type errors block the bundle.
- `typecheck` exposed separately for root `typecheck` script to call standalone.
- `dependencies`: `vue` + `vant` (runtime) + workspace `@qq-dld/shared` (types).
- `devDependencies`: `vite`, `@vitejs/plugin-vue`, `vue-tsc`. `typescript` is hoisted at root (Group 1.3), don't redeclare.
- Pin Vant4 (`^4.x`), Vue3 (`^3.4.x`) — major-version locked per design title.

### 5.3 Create `packages/web/vite.config.ts`

File: `C:\Users\中科华汇\Desktop\qq-dld\packages\web\vite.config.ts`

Content:
```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
```

Key decisions:
- Minimal config; no aliases needed yet. `@qq-dld/shared` resolves via npm workspace link + `exports` field (set in Group 3.1).
- `outDir: dist` matches the web dist pattern excluded in `.gitignore` (Group 1.3) and the spec's `dist/` expectation.
- Dev server on Vite default port 5173 (avoids clashing with legacy `src/` app's port 3000).

### 5.4 Create `packages/web/index.html`

File: `C:\Users\中科华汇\Desktop\qq-dld\packages\web\index.html`

Content:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>qq-dld</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

### 5.5 Create `packages/web/src/App.vue`

File: `C:\Users\中科华汇\Desktop\qq-dld\packages\web\src\App.vue`

Content (minimal SFC; mounts a Vant button to prove the Vant install works):
```vue
<script setup lang="ts">
import { ref, type Ref } from 'vue';
import type { Account } from '@qq-dld/shared';
import { VButton } from 'vant';

const account: Ref<Account> = ref({
  id: 1,
  nickname: 'web-sample',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
</script>

<template>
  <div class="root">
    <h1>qq-dld web</h1>
    <VButton>{{ account.nickname }}</VButton>
  </div>
</template>

<style scoped>
.root {
  font-family: sans-serif;
  padding: 1rem;
}
</style>
```

Key decisions:
- `import type { Account } from '@qq-dld/shared'` — satisfies spec scenario "Import shared type from web".
- `VButton` from `vant` — proves Vant4 tree-shakeable import works through Vite.
- `lang="ts"` in `<script setup>` — required for `vue-tsc` to type-check the SFC.
- `account` is used in template so `noUnusedLocals` passes.

### 5.6 Create `packages/web/src/main.ts`

File: `C:\Users\中科华汇\Desktop\qq-dld\packages\web\src\main.ts`

Content:
```ts
import { createApp } from 'vue';
import App from './App.vue';
import 'vant/lib/index.css';

createApp(App).mount('#app');
```

Key decisions:
- Imports the Vant4 stylesheet entry. (Vant4's CSS is at `vant/lib/index.css` per Vant4 docs; alternative would be `vant/es/index.less` but `lib` CSS is precompiled and works without a CSS preprocessor.)
- Mounts to `#app` element declared in `index.html` (5.4).
- `import App from './App.vue'` — vue-tsc + plugin-vue handle the `.vue` import shim.

### 5.7 Verify Group 5

Install web's deps (hoisted to root by npm workspaces):
```powershell
npm install -w @qq-dld/web
```
**Expected:** adds `vue`, `vant`, `vite`, `@vitejs/plugin-vue`, `vue-tsc` to root `node_modules/`; `packages/web/node_modules/` may contain overrides but should otherwise be sparse.

```powershell
npm run typecheck -w @qq-dld/web
```
**Expected:** `vue-tsc --noEmit` exits 0 (no type errors). This validates the SFC + cross-package type import in the web toolchain.

```powershell
npm run build -w @qq-dld/web
```
**Expected:** runs `vue-tsc --noEmit` (pass) then `vite build`, producing `packages/web/dist/` containing `index.html`, `assets/` with hashed `.js` + `.css`. Exits 0.

If `vue-tsc` complains it cannot find `vant/lib/index.css` types, that is a CSS module declaration gap — add a shim:
File (only if needed): `C:\Users\中科华汇\Desktop\qq-dld\packages\web\src\env.d.ts`
```ts
/// <reference types="vite/client" />
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
declare module '*.css';
```
*Reactive: add this file ONLY if the verify step errors on missing module declarations.*

archived-with: 2026-07-09-monorepo-scaffolding
---

## Group 6 — Cross-package orchestration + verification

**Objective:** wire up the root orchestration scripts and verify the whole monorepo builds, typechecks, and runs end-to-end without disturbing the legacy app.

### 6.1 Add root orchestration scripts (edit root `package.json`)

File: `C:\Users\中科华汇\Desktop\qq-dld\package.json`

Append (additatively; do NOT touch legacy `start`/`stop`/`dev`):
```json
"build": "npm run build --workspaces",
"typecheck": "tsc --build --force && vue-tsc --noEmit -p packages/web/tsconfig.json",
"dev:workspaces": "npm run dev --workspaces"
```

Resulting `scripts` block:
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

Key decisions:
- `build` = `npm run build --workspaces` — npm executes scripts in `workspaces` array order (shared → server → web), satisfying spec scenario "Root build orchestrates workspaces". For server, this also transitively builds shared via the `references` graph (and `npm --workspaces` order ensures shared finishes first regardless).
- `typecheck` chains `tsc --build --force` (rebuilds shared+server from clean) with `&&` then `vue-tsc --noEmit -p packages/web/tsconfig.json`. `--force` ensures a stale `tsbuildinfo` can't mask a type regression — acceptable cost for a skeleton. Production-grade incremental runs can drop `--force` later.
- `dev:workspaces` = `npm run dev --workspaces` — runs each workspace's `dev` in array order. Note (design §7 open question): this runs **sequentially**, not concurrently. For a true concurrent dev experience, add `"concurrently": "^9.0.0"` as a root devDep and use `concurrently "npm:dev -w @qq-dld/shared" "npm:dev -w @qq-dld/server" "npm:dev -w @qq-dld/web"` — but `shared` has no `dev` (types only). For the skeleton, sequential `dev` across only server+tsc-watch fails gracefully on shared (no script). **Decision: do not include `dev:workspaces` with workspace-shared `dev`; instead define it to only run web's dev for now, OR leave the sequential form and document that shared lacks dev.** Given shared has no `dev` script, `npm run dev --workspaces` would warn "No `dev` script on @qq-dld/shared" and skip it — acceptable. Keep the simple form; revisit in the next change when server has a real Fastify dev with watch.

### 6.2 Verification matrix (run from repo root, PowerShell)

| # | Command | Expected outcome | Spec scenario covered |
|---|---|---|---|
| 6.2.1 | `npm install` | exit 0; 3 workspaces link into root `node_modules/@qq-dld/*` as junctions | "Workspaces recognized by npm" |
| 6.2.2 | `npm ls --workspaces --depth=0` | lists `@qq-dld/shared`, `@qq-dld/server`, `@qq-dld/web` with versions `0.0.0` | (workspace recognition) |
| 6.2.3 | `npx tsc --showConfig -p packages/shared/tsconfig.json` | prints extended config, `composite: true` | TS hierarchy |
| 6.2.4 | `npm run build --workspaces` | exits 0; builds shared → server → web; leaves `packages/{shared,server,web}/dist/` populated | "Build all workspaces", "Server emits CommonJS" |
| 6.2.5 | `npm run build` | same as 6.2.4 (root orchestration script) | "Root build orchestrates workspaces" |
| 6.2.6 | `npm run typecheck` | runs `tsc --build --force` (shared+server, exit 0) then `vue-tsc --noEmit` (web, exit 0); whole pipeline exits 0 | "Cross-package typecheck" |
| 6.2.7 | `node packages\server\dist\index.js` | logs `[qq-dld/server] skeleton ready sample`; exit 0 | "Server emits CommonJS", "Import shared type from server" |
| 6.2.8 | `npm start` | legacy `src/web/index.js` Express app starts and listens on port 3000; manual GET http://localhost:3000 returns 200 | "Legacy app still runnable", "Legacy scripts preserved" |
| 6.2.9 | `npm stop` | legacy stop script runs `stop.js` unchanged | "Legacy scripts preserved" |
| 6.2.10 | Inspect `packages/web/dist/index.html` | Vite index present with hashed asset references | web build output |
| 6.2.11 | `git status --short` | only `package.json`, `package-lock.json`, `tsconfig.base.json`, `tsconfig.json`, `.gitignore`, `packages/**` are new/modified. NO `src/`, `public/`, `data/`, `stop.js` changes. | rollback-path cleanliness |

### 6.3 Manual cross-boundary spot check

After 6.2.4 succeeds, temporarily break the type boundary to prove typecheck catches it:
```powershell
# Temporarily rename Account to wrong type in server ( sanity check)
```
Not strictly necessary; the `import type { Account }` in `server/src/index.ts` and `web/src/App.vue` already exercises the boundary. If typecheck (6.2.6) passes and both files reference the imported type, the boundary is proven.

### 6.4 Rollback path (documented, not executed)

If any group fails irrecoverably:
```powershell
git checkout -- package.json package-lock.json .gitignore
Remove-Item -Recurse -Force packages, tsconfig.json, tsconfig.base.json -ErrorAction SilentlyContinue
npm install
```
This restores the single-package legacy state. (From design §5.) Per 6.2.11, the rollback touches only additive artifacts — `src/`, `public/`, `data/`, `stop.js` are unchanged by this change, so rollback never affects the legacy app.

archived-with: 2026-07-09-monorepo-scaffolding
---

## 7. Files created / modified summary

### Modified (additive only)
- `package.json` — `workspaces`, `private`, `devDependencies.typescript`, `devDependencies.@types/node`, `scripts.build`, `scripts.typecheck`, `scripts.dev:workspaces`. Legacy deps + legacy scripts untouched.
- `package-lock.json` — regenerated by `npm install`.
- `.gitignore` — appended dist/tsbuildinfo exclusions.

### Created (new)
- `tsconfig.base.json`
- `tsconfig.json` (root, solution-style)
- `packages/shared/package.json`
- `packages/shared/tsconfig.json`
- `packages/shared/src/index.ts`
- `packages/shared/src/types/account.ts`
- `packages/shared/src/types/module.ts`
- `packages/shared/src/types/exec-log.ts`
- `packages/shared/src/types/friend.ts`
- `packages/shared/src/types/task-config.ts`
- `packages/shared/src/types/scheduler-job.ts`
- `packages/server/package.json`
- `packages/server/tsconfig.json`
- `packages/server/src/index.ts`
- `packages/web/package.json`
- `packages/web/tsconfig.json`
- `packages/web/vite.config.ts`
- `packages/web/index.html`
- `packages/web/src/main.ts`
- `packages/web/src/App.vue`
- `packages/web/src/env.d.ts` (ONLY if 5.7 verification needs it — see reactive note)

### Generated (git-ignored, not committed)
- `packages/*/dist/`
- `packages/*/tsconfig.tsbuildinfo`
- `packages/web/dist/`
- `packages/web/node_modules/` (sparse)
- root `node_modules/` updates from `npm install`

### NOT touched (verified by 6.2.11)
- `src/**` (legacy CommonJS app)
- `public/**` (legacy single-page HTML)
- `data/**` (SQLite db)
- `stop.js`
- existing root `dependencies` block (express, sql.js, axios, node-schedule, puppeteer-core, @fission-ai/openspec, @rpamis/comet)
- existing root `scripts.start`, `scripts.stop`, `scripts.dev`
- existing root `devDependencies.@playwright/test`

archived-with: 2026-07-09-monorepo-scaffolding
---

## 8. Risks / gotchas register (Windows-specific)

| Risk | Mitigation in this plan |
|---|---|
| `npm install` fails creating workspace junctions on Windows pre-npm-9 | Plan assumes npm 9+ (Group 1.4 verification). Pre-9 would use symlinks needing dev mode/admin. |
| `tsc --build` caches stale `.tsbuildinfo` and reports false success | Root `typecheck` uses `--force`; per-package `build` uses plain `--build` (incremental OK during dev). If in doubt, delete `packages/*/tsconfig.tsbuildinfo`. |
| `vue-tsc` cannot find `.vue` modules | Add `packages/web/src/env.d.ts` with `*.vue` shim (5.7 reactive note). |
| `@qq-dld/shared` not resolving after edits | Re-run `npm install` whenever a `packages/*/package.json` `name`/`version` changes. Keep `@qq-dld/shared`'s version (`0.0.0`) in lockstep with the `dependencies."@qq-dld/shared"` declared by server (4.1) and web (5.2). |
| Vant4 CSS path changes | `vant/lib/index.css` is the documented Vant4 entry; `vant/es/index.css` may also work. If build errors on CSS import, switch path. Bumping to Vant5 would change this — pin `^4` (5.2). |
| `noUnusedLocals` fails on skeleton code | All skeleton code uses every declared symbol (sampleAccount logged in server; account used in template in web). If a later edit adds an unused symbol, delete it or prefix with `_`. |
| Legacy app's `main: src/web/index.js` collides with npm workspace behavior | root `main` field is informational-only for workspace roots; legacy `npm start` reads `scripts.start`, not `main`. No conflict. |
| `npm run build --workspaces` runs shared after server if order isn't respected | The `workspaces` array IS order-sensitive and npm respects it (Group 1.1 puts shared first). Plus `server/tsconfig.json#references` forces shared-before-server at the tsc level regardless. Belt and suspenders. |

archived-with: 2026-07-09-monorepo-scaffolding
---

## 9. Estimated effort & ordering

| Group | Files | Est. |
|---|---|---|
| 1 Root config | 2 modified (`package.json`, `.gitignore`) + 3 placeholder package.json | small |
| 2 TS config | 5 tsconfig files | small |
| 3 shared | 1 package.json + 1 index + 6 type files | small |
| 4 server | 1 package.json + 1 src file | tiny |
| 5 web | 1 package.json + 4 src/config files (+ optional env.d.ts) | medium |
| 6 Orchestration | 1 edit to `package.json` + verification | small |

Total: ~23 file operations + `npm install` + verification runs. A developer following this plan straight through should complete it in one sitting (~1-2 hours including verification iterations).

archived-with: 2026-07-09-monorepo-scaffolding
---

## 10. Post-change checklist (acceptance)

Before declaring the change complete, all of the following must pass:

- [x] `npm install` exits 0 with workspaces recognized
- [x] `npm run build` builds all 3 workspaces; `packages/{shared,server,web}/dist/` populated
- [x] `npm run typecheck` exits 0 (tsc --build for shared+server; vue-tsc for web)
- [x] `node packages\server\dist\index.js` logs the skeleton line
- [x] `npm start` launches the legacy app on port 3000 (manual GET returns 200)
- [x] `git status` shows ONLY additive artifacts; no `src/`, `public/`, `data/`, `stop.js` modifications
- [x] Rollback path (§6.4) verified mentally against the file list in §7

When all boxes are checked, the monorepo scaffold is complete and ready for the next change (which will introduce Fastify + better-sqlite3 + multi-account into `packages/server`).
