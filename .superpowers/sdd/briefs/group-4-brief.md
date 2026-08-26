# Group 4: packages/server Skeleton

## Tasks Covered
- Task 4.1: Overwrite `packages/server/package.json`
- Task 4.2: Create `packages/server/src/index.ts`
- Task 4.3: Build and verify server package

## Context
- Workspace dep `@qq-dld/shared` must resolve (npm workspace link from Group 1)
- `packages/server/tsconfig.json` already exists from Group 2 with `references: [{ path: "../shared" }]`

## Environment
- Repo root: `E:\github\qq-dld`
- Platform: Windows (PowerShell)
- CJS output (matching existing legacy `src/` app)

## 4.1 Overwrite `packages/server/package.json`

File: `E:\github\qq-dld\packages\server\package.json`
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

## 4.2 Create `packages/server/src/index.ts`

File: `E:\github\qq-dld\packages\server\src\index.ts`
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

## 4.3 Verify
```powershell
npm install
npx tsc --build packages/server/tsconfig.json
```
Expected: builds shared (if stale) then server; exits 0.

```powershell
npm run build -w @qq-dld/server
node packages\server\dist\index.js
```
Expected: logs `[qq-dld/server] skeleton ready sample` and exits 0.

## Commit
After completing, commit with: `feat: create server package skeleton with workspace type import`
