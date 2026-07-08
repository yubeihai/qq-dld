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
