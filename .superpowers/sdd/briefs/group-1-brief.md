# Group 1: Root Workspace Configuration

## Tasks Covered
- Task 1.1: Add `workspaces` field, root scripts, devDeps to root `package.json`
- Task 1.2: Create `packages/` directory + placeholder package.json files
- Task 1.3: Update `.gitignore` with build output exclusions
- Task 1.4: Run `npm install` and verify workspace recognition

## Group-level Verification
After this group, the following must be true:
- `npm install` succeeds with workspaces recognized (junctions/hoisting)
- `npm ls --workspaces` lists `@qq-dld/shared`, `@qq-dld/server`, `@qq-dld/web`

## Environment
- Platform: Windows (PowerShell 5.1). Use `Remove-Item -Recurse -Force` not `rm -rf`.
- Node.js + npm only — no pnpm/yarn
- All modifications to `package.json` are additive-only; do not touch legacy `start`/`stop`/`dev` scripts or existing `dependencies`
- Legacy `src/`, `public/`, `data/`, `stop.js` are NOT modified

## 1.1 Modify `package.json` (root, additive only)

File: `E:\github\qq-dld\package.json`

Current `scripts` block (preserve exactly):
```json
"scripts": {
  "start": "node src/web/index.js",
  "stop": "node stop.js",
  "dev": "node src/web/index.js"
}
```

Current `dependencies` (preserve exactly):
```json
"dependencies": {
  "@fission-ai/openspec": "^1.5.0",
  "@rpamis/comet": "^0.4.0-beta.2",
  "axios": "^1.6.7",
  "express": "^4.18.2",
  "node-schedule": "^2.1.1",
  "puppeteer-core": "^22.6.4",
  "sql.js": "^1.10.3"
}
```

Current `devDependencies`:
```json
"devDependencies": {
  "@playwright/test": "^1.58.2"
}
```

### Changes to make:

1. Add `"private": true` as a top-level field
2. Add `"workspaces": ["packages/shared", "packages/server", "packages/web"]` as a top-level field
3. Add `"typescript": "^5.4.5"` and `"@types/node": "^20.12.7"` to `devDependencies`
4. **Do NOT add `scripts.build`/`typecheck`/`dev:workspaces` yet** — those are added in Group 6

### Resulting structure (only the new/additive fields):
```json
{
  "private": true,
  "workspaces": ["packages/shared", "packages/server", "packages/web"],
  "devDependencies": {
    "@playwright/test": "^1.58.2",
    "typescript": "^5.4.5",
    "@types/node": "^20.12.7"
  }
}
```

## 1.2 Create `packages/` directory structure

Run (PowerShell):
```
New-Item -ItemType Directory -Path "packages\shared\src\types" -Force
New-Item -ItemType Directory -Path "packages\server\src" -Force
New-Item -ItemType Directory -Path "packages\web\src" -Force
```

Create placeholder package.json files (so `npm install` recognizes workspaces):

`packages/shared/package.json`:
```json
{ "name": "@qq-dld/shared", "version": "0.0.0", "private": true }
```

`packages/server/package.json`:
```json
{ "name": "@qq-dld/server", "version": "0.0.0", "private": true }
```

`packages/web/package.json`:
```json
{ "name": "@qq-dld/web", "version": "0.0.0", "private": true }
```

## 1.3 Update `.gitignore`

File: `E:\github\qq-dld\.gitignore`

Add the following lines:
```
# TypeScript build output
packages/*/dist/
packages/*/tsconfig.tsbuildinfo
*.tsbuildinfo

# Vite build output (web)
packages/web/dist/
```

Verify `node_modules/` and `data/` are already present in `.gitignore`.

## 1.4 Verify Group 1

```powershell
npm install
```
Expected: install succeeds; `node_modules/` hoists `typescript`; `node_modules/@qq-dld/shared` etc. are junctions back to `packages/*`. No workspace warnings.

```powershell
npm ls --workspaces
```
Expected: lists `@qq-dld/shared`, `@qq-dld/server`, `@qq-dld/web` with `0.0.0` versions.

## Commit
After completing, commit with message: `feat: add npm workspace root config, packages dir, and .gitignore exclusions`
