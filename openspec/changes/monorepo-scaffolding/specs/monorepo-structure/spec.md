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
