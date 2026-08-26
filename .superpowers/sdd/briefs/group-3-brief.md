# Group 3: packages/shared Skeleton

## Tasks Covered
- Task 3.1: Overwrite `packages/shared/package.json` with full metadata
- Task 3.2: Create `packages/shared/src/index.ts` (barrel re-exports)
- Task 3.3: Create 7 domain type declaration files
- Task 3.4: Build and verify shared package

## Context
shared is a type-only package (no runtime logic). The placeholder `packages/shared/package.json` already exists from Group 1. All tsconfigs from Group 2 are already in place.

## Environment
- Repo root: `E:\github\qq-dld`
- Platform: Windows, npm workspaces active

## 3.1 Overwrite `packages/shared/package.json`

File: `E:\github\qq-dld\packages\shared\package.json`
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

## 3.2 Create `packages/shared/src/index.ts`

File: `E:\github\qq-dld\packages\shared\src\index.ts`
```ts
export type { Account } from './types/account';
export type { Module, ModuleConfig } from './types/module';
export type { ExecLog } from './types/exec-log';
export type { Friend } from './types/friend';
export type { TaskConfig } from './types/task-config';
export type { SchedulerJob } from './types/scheduler-job';
```

## 3.3 Create domain type declaration files

All files use `export interface` (open for extension).

### `packages/shared/src/types/account.ts`
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

### `packages/shared/src/types/module.ts`
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

### `packages/shared/src/types/exec-log.ts`
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

### `packages/shared/src/types/friend.ts`
```ts
export interface Friend {
  id: number;
  uin: string;
  nickname: string;
  level?: number;
  foughtToday: boolean;
}
```

### `packages/shared/src/types/task-config.ts`
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

### `packages/shared/src/types/scheduler-job.ts`
```ts
export interface SchedulerJob {
  id: string;
  taskConfigId: number;
  running: boolean;
}
```
Note: `nextRunAt` field removed from original spec to match the design doc.

## 3.4 Verify
```powershell
npx tsc --build packages/shared/tsconfig.json
```
Expected: exits 0; creates `packages/shared/dist/` with `.js`, `.d.ts`, and maps.

```powershell
npm run build -w @qq-dld/shared
```
Expected: same result via the package's build script.

## Commit
After completing, commit with: `feat: create shared types package with 7 domain type skeletons`
